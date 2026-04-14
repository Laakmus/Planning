// Stale z seed.sql — dane testowe dla E2E
// Po AUTH-MIG A3: logowanie przez username+hasło (email zachowany do integracji Outlook).
export const TEST_USER = {
  username: "admin",
  password: "test1234",
  email: "admin@test.pl",
  id: "c94a20d0-16ca-4f9d-873a-05f31be633ff",
  fullName: "Jan Kowalski",
  role: "ADMIN" as const,
};

// UUID zlecen z seed.sql (d0000000-0000-0000-0000-00000000000X)
export const ORDERS = {
  robocze1: {
    id: "d0000000-0000-0000-0000-000000000001",
    orderNo: "ZT2026/0001",
    status: "robocze",
    transport: "PL",
  },
  wyslane: {
    id: "d0000000-0000-0000-0000-000000000002",
    orderNo: "ZT2026/0002",
    status: "wysłane",
    transport: "EXP",
  },
  korekta: {
    id: "d0000000-0000-0000-0000-000000000003",
    orderNo: "ZT2026/0003",
    status: "korekta",
    transport: "PL",
  },
  korektaWyslane: {
    id: "d0000000-0000-0000-0000-000000000004",
    orderNo: "ZT2026/0004",
    status: "korekta wysłane",
    transport: "EXP",
  },
  zrealizowane: {
    id: "d0000000-0000-0000-0000-000000000005",
    orderNo: "ZT2026/0005",
    status: "zrealizowane",
    transport: "PL",
  },
  reklamacja: {
    id: "d0000000-0000-0000-0000-000000000006",
    orderNo: "ZT2026/0006",
    status: "reklamacja",
    transport: "IMP",
  },
  anulowane: {
    id: "d0000000-0000-0000-0000-000000000007",
    orderNo: "ZT2026/0007",
    status: "anulowane",
    transport: "PL",
  },
  robocze2: {
    id: "d0000000-0000-0000-0000-000000000008",
    orderNo: "ZT2026/0008",
    status: "robocze",
    transport: "IMP",
  },
  robocze3: {
    id: "d0000000-0000-0000-0000-000000000009",
    orderNo: "ZT2026/0009",
    status: "robocze",
    transport: "PL",
  },
  robocze4: {
    id: "d0000000-0000-0000-0000-000000000010",
    orderNo: "ZT2026/0010",
    status: "robocze",
    transport: "EXP",
  },
} as const;

// Statusy w widoku "Aktualne" (CURRENT view_group)
export const CURRENT_STATUSES = [
  "robocze",
  "wysłane",
  "korekta",
  "korekta wysłane",
  "reklamacja",
] as const;

// Oczekiwana liczba zlecen w widoku "Aktualne" z seed.sql
// 7 robocze + 6 wyslane + 3 korekta + 2 korekta_w + 3 reklamacja = 21
export const EXPECTED_CURRENT_COUNT = 21;
