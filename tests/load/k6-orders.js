/**
 * Planning App — k6 Load Test
 *
 * Testuje 50 concurrent users na endpointach orders CRUD, list, PDF.
 *
 * Wymagania:
 *   - k6 zainstalowany: https://k6.io/docs/get-started/installation/
 *   - Działająca aplikacja (dev lub produkcja)
 *
 * Użycie:
 *   K6_BASE_URL=http://localhost:4321 K6_AUTH_EMAIL=admin@test.pl K6_AUTH_PASSWORD=test1234 k6 run tests/load/k6-orders.js
 *
 * Zmienne środowiskowe:
 *   K6_BASE_URL     — URL aplikacji (default: http://localhost:4321)
 *   K6_AUTH_EMAIL    — email użytkownika testowego (default: admin@test.pl)
 *   K6_AUTH_PASSWORD — hasło użytkownika testowego (default: test1234)
 *   K6_SUPABASE_URL — URL Supabase (default: http://127.0.0.1:54331)
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

// --- Konfiguracja ---
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:4321";
const AUTH_EMAIL = __ENV.K6_AUTH_EMAIL || "admin@test.pl";
const AUTH_PASSWORD = __ENV.K6_AUTH_PASSWORD || "test1234";
const SUPABASE_URL = __ENV.K6_SUPABASE_URL || "http://127.0.0.1:54331";

// --- Custom metrics ---
const errorRate = new Rate("errors");
const listDuration = new Trend("list_orders_duration", true);
const getDuration = new Trend("get_order_duration", true);
const createDuration = new Trend("create_order_duration", true);
const updateDuration = new Trend("update_order_duration", true);
const pdfDuration = new Trend("pdf_duration", true);

// --- Scenariusze ---
export const options = {
  scenarios: {
    // Przeglądanie listy zleceń — główny use case
    list_orders: {
      executor: "constant-vus",
      vus: 25,
      duration: "2m",
      exec: "listOrders",
    },
    // Podgląd szczegółów zlecenia
    get_order: {
      executor: "constant-vus",
      vus: 10,
      duration: "2m",
      exec: "getOrder",
      startTime: "10s",
    },
    // Tworzenie nowych zleceń
    create_order: {
      executor: "constant-vus",
      vus: 5,
      duration: "1m30s",
      exec: "createOrder",
      startTime: "20s",
    },
    // Aktualizacja zleceń
    update_order: {
      executor: "constant-vus",
      vus: 5,
      duration: "1m30s",
      exec: "updateOrder",
      startTime: "20s",
    },
    // Generowanie PDF
    generate_pdf: {
      executor: "constant-vus",
      vus: 5,
      duration: "1m",
      exec: "generatePdf",
      startTime: "30s",
    },
  },
  thresholds: {
    "list_orders_duration": ["p(95)<500"],
    "get_order_duration": ["p(95)<500"],
    "create_order_duration": ["p(95)<2000"],
    "update_order_duration": ["p(95)<2000"],
    "pdf_duration": ["p(95)<5000"],
    errors: ["rate<0.01"],
  },
};

// --- Auth: pobranie JWT tokena przez Supabase GoTrue ---
export function setup() {
  const loginRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: AUTH_EMAIL,
      password: AUTH_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        apikey: getAnonKey(),
      },
    }
  );

  check(loginRes, {
    "login successful": (r) => r.status === 200,
  });

  if (loginRes.status !== 200) {
    console.error(`Login failed: ${loginRes.status} ${loginRes.body}`);
    return { token: "" };
  }

  const body = JSON.parse(loginRes.body);
  console.log(`Authenticated as ${AUTH_EMAIL}`);
  return { token: body.access_token };
}

function getAnonKey() {
  // Supabase local default anon key — nadpisz K6_SUPABASE_ANON_KEY jeśli inny
  return (
    __ENV.K6_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
  );
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// --- Scenariusz: Lista zleceń ---
export function listOrders(data) {
  const page = Math.floor(Math.random() * 3) + 1;
  const res = http.get(
    `${BASE_URL}/api/v1/orders?page=${page}&pageSize=20&view=CURRENT`,
    { headers: authHeaders(data.token) }
  );

  listDuration.add(res.timings.duration);
  const ok = check(res, {
    "list 200": (r) => r.status === 200,
    "list has data": (r) => {
      try {
        return JSON.parse(r.body).data !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!ok);
  sleep(1 + Math.random());
}

// --- Scenariusz: Podgląd zlecenia ---
export function getOrder(data) {
  // Pobierz listę żeby mieć prawdziwe ID
  const listRes = http.get(
    `${BASE_URL}/api/v1/orders?page=1&pageSize=5&view=CURRENT`,
    { headers: authHeaders(data.token) }
  );

  if (listRes.status !== 200) {
    errorRate.add(true);
    sleep(1);
    return;
  }

  let orders;
  try {
    orders = JSON.parse(listRes.body).data;
  } catch {
    errorRate.add(true);
    sleep(1);
    return;
  }

  if (!orders || orders.length === 0) {
    sleep(1);
    return;
  }

  const orderId = orders[Math.floor(Math.random() * orders.length)].id;
  const res = http.get(`${BASE_URL}/api/v1/orders/${orderId}`, {
    headers: authHeaders(data.token),
  });

  getDuration.add(res.timings.duration);
  const ok = check(res, { "get 200": (r) => r.status === 200 });
  errorRate.add(!ok);
  sleep(1 + Math.random());
}

// --- Scenariusz: Tworzenie zlecenia ---
export function createOrder(data) {
  const body = {
    transportTypeCode: "PL",
    currencyCode: "PLN",
    stops: [
      {
        kind: "LOADING",
        sequenceNo: 1,
        locationId: null,
        plannedDate: "2026-04-01",
        plannedTime: "08:00",
        notes: `k6 load test ${Date.now()}`,
      },
      {
        kind: "UNLOADING",
        sequenceNo: 2,
        locationId: null,
        plannedDate: "2026-04-02",
        plannedTime: "14:00",
        notes: null,
      },
    ],
    items: [
      {
        productId: null,
        productNameSnapshot: "Test product k6",
        loadingMethodCode: null,
        quantityTons: 10,
        notes: null,
      },
    ],
  };

  const res = http.post(`${BASE_URL}/api/v1/orders`, JSON.stringify(body), {
    headers: authHeaders(data.token),
  });

  createDuration.add(res.timings.duration);
  const ok = check(res, {
    "create 201 or 200": (r) => r.status === 201 || r.status === 200,
  });
  errorRate.add(!ok);
  sleep(2 + Math.random());
}

// --- Scenariusz: Aktualizacja zlecenia ---
export function updateOrder(data) {
  const listRes = http.get(
    `${BASE_URL}/api/v1/orders?page=1&pageSize=5&view=CURRENT`,
    { headers: authHeaders(data.token) }
  );

  if (listRes.status !== 200) {
    errorRate.add(true);
    sleep(1);
    return;
  }

  let orders;
  try {
    orders = JSON.parse(listRes.body).data;
  } catch {
    errorRate.add(true);
    sleep(1);
    return;
  }

  if (!orders || orders.length === 0) {
    sleep(1);
    return;
  }

  const order = orders[Math.floor(Math.random() * orders.length)];

  // Pobierz szczegóły
  const detailRes = http.get(`${BASE_URL}/api/v1/orders/${order.id}`, {
    headers: authHeaders(data.token),
  });

  if (detailRes.status !== 200) {
    errorRate.add(true);
    sleep(1);
    return;
  }

  // Lock + Update + Unlock
  http.post(`${BASE_URL}/api/v1/orders/${order.id}/lock`, null, {
    headers: authHeaders(data.token),
  });

  const updateBody = {
    transportTypeCode: "PL",
    currencyCode: "PLN",
    generalNotes: `k6 update ${Date.now()}`,
    stops: [],
    items: [],
  };

  const res = http.put(
    `${BASE_URL}/api/v1/orders/${order.id}`,
    JSON.stringify(updateBody),
    { headers: authHeaders(data.token) }
  );

  updateDuration.add(res.timings.duration);
  const ok = check(res, {
    "update 200": (r) => r.status === 200,
  });
  errorRate.add(!ok);

  http.del(`${BASE_URL}/api/v1/orders/${order.id}/lock`, null, {
    headers: authHeaders(data.token),
  });

  sleep(2 + Math.random());
}

// --- Scenariusz: Generowanie PDF ---
export function generatePdf(data) {
  const listRes = http.get(
    `${BASE_URL}/api/v1/orders?page=1&pageSize=3&view=CURRENT`,
    { headers: authHeaders(data.token) }
  );

  if (listRes.status !== 200) {
    errorRate.add(true);
    sleep(2);
    return;
  }

  let orders;
  try {
    orders = JSON.parse(listRes.body).data;
  } catch {
    errorRate.add(true);
    sleep(2);
    return;
  }

  if (!orders || orders.length === 0) {
    sleep(2);
    return;
  }

  const orderId = orders[Math.floor(Math.random() * orders.length)].id;
  const res = http.post(`${BASE_URL}/api/v1/orders/${orderId}/pdf`, null, {
    headers: authHeaders(data.token),
    responseType: "binary",
  });

  pdfDuration.add(res.timings.duration);
  const ok = check(res, {
    "pdf 200": (r) => r.status === 200,
    "pdf content-type": (r) =>
      (r.headers["Content-Type"] || "").includes("application/pdf"),
  });
  errorRate.add(!ok);
  sleep(3 + Math.random());
}
