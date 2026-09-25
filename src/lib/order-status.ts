/**
 * Statusy zleceń — jedno źródło prawdy dla backendu i frontendu.
 *
 * Wartości odpowiadają `order_statuses.code` w bazie (polskie kody techniczne).
 * Moduł nie ma zależności, więc może być importowany zarówno w serwisach, jak i komponentach.
 */

/** Kody statusów zlecenia. */
export const ORDER_STATUS = {
  DRAFT: "robocze",
  SENT: "wysłane",
  CORRECTION: "korekta",
  CORRECTION_SENT: "korekta wysłane",
  COMPLETED: "zrealizowane",
  COMPLAINT: "reklamacja",
  CANCELLED: "anulowane",
} as const;

/** Kod statusu zlecenia (odpowiada order_statuses.code w bazie). */
export type OrderStatusCode = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** Wszystkie kody statusów (kolejność jak w UI). */
export const ORDER_STATUS_CODES = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.SENT,
  ORDER_STATUS.CORRECTION,
  ORDER_STATUS.CORRECTION_SENT,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.COMPLAINT,
  ORDER_STATUS.CANCELLED,
] as const satisfies readonly OrderStatusCode[];

/** Statusy końcowe — zlecenie tylko do odczytu (bez edycji, blokady, zmian statusu). */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set<OrderStatusCode>([
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
]);

/** Statusy „wysłane" — edycja danych przestawia zlecenie na korektę. */
export const SENT_STATUSES: ReadonlySet<string> = new Set<OrderStatusCode>([
  ORDER_STATUS.SENT,
  ORDER_STATUS.CORRECTION_SENT,
]);

/** Statusy, z których można wysłać zlecenie mailem (prepare-email). */
export const EMAIL_SENDABLE_STATUSES: ReadonlySet<string> = new Set<OrderStatusCode>([
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.CORRECTION,
  ORDER_STATUS.SENT,
  ORDER_STATUS.CORRECTION_SENT,
]);

/** Statusy widoczne w raporcie magazynowym. */
export const WAREHOUSE_VISIBLE_STATUSES: readonly OrderStatusCode[] = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.SENT,
  ORDER_STATUS.CORRECTION,
  ORDER_STATUS.CORRECTION_SENT,
  ORDER_STATUS.COMPLAINT,
];

/** Status po wysłaniu maila: robocze → wysłane, korekta → korekta wysłane. */
export const STATUS_AFTER_EMAIL: Readonly<Record<string, OrderStatusCode>> = {
  [ORDER_STATUS.DRAFT]: ORDER_STATUS.SENT,
  [ORDER_STATUS.CORRECTION]: ORDER_STATUS.CORRECTION_SENT,
  [ORDER_STATUS.SENT]: ORDER_STATUS.SENT,
  [ORDER_STATUS.CORRECTION_SENT]: ORDER_STATUS.CORRECTION_SENT,
};

/**
 * Matryca dozwolonych ręcznych przejść statusów (PRD 3.1.7, api-plan 2.7):
 * status bieżący → statusy docelowe.
 *
 * Statusy "wysłane" i "korekta wysłane" ustawiane są automatycznie przez prepare-email
 * i NIE są dostępne jako cel ręcznej zmiany. Zrealizowane i anulowane — tylko „Przywróć".
 */
export const ALLOWED_MANUAL_STATUS_TRANSITIONS: Readonly<Record<OrderStatusCode, readonly OrderStatusCode[]>> = {
  [ORDER_STATUS.DRAFT]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SENT]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.COMPLAINT, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CORRECTION]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.COMPLAINT, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CORRECTION_SENT]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.COMPLAINT, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLAINT]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

/** Czy ręczne przejście `from` → `to` jest dozwolone. */
export function isManualTransitionAllowed(from: string, to: string): boolean {
  const targets = ALLOWED_MANUAL_STATUS_TRANSITIONS[from as OrderStatusCode];
  return targets?.includes(to as OrderStatusCode) ?? false;
}
