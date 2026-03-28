import { test as setup, expect } from "@playwright/test";

const SUPABASE_URL = "http://127.0.0.1:54331";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const AUTH_FILE = "e2e/.auth/admin.json";

// Klucz localStorage zgodny z konwencją Supabase JS SDK:
// `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
// Dla http://127.0.0.1:54331 → hostname = "127.0.0.1" → split(".")[0] = "127"
const STORAGE_KEY = "sb-127-auth-token";

setup("reset database and authenticate", async ({ request }) => {
  // Krok 1: Reset bazy danych (seed.sql laduje dane testowe)
  // UWAGA: supabase db reset uruchamiany recznie lub w CI, nie tutaj
  // (zbyt wolne dla kazdego uruchomienia testow)

  // Krok 2: Logowanie przez API Supabase GoTrue
  const response = await request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      data: {
        email: "admin@test.pl",
        password: "test1234",
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  const authData = await response.json();

  // Krok 3: Zapisz storageState z tokenami w localStorage
  // Aplikacja uzywa Supabase auth — token przechowywany w localStorage
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: "http://localhost:4321",
        localStorage: [
          {
            name: STORAGE_KEY,
            value: JSON.stringify({
              access_token: authData.access_token,
              refresh_token: authData.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              expires_in: 3600,
              token_type: "bearer",
              user: authData.user,
            }),
          },
        ],
      },
    ],
  };

  // Zapisz do pliku
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));
});
