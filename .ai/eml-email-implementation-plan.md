# Plan: "Wyślij maila" — generacja .eml z załączonym PDF

## Context

Przycisk "Wyślij maila" w drawerze zlecenia obecnie otwiera `mailto:` link bez załącznika PDF (protokół `mailto:` nie obsługuje załączników). PRD wymaga, by klik otwierał klienta poczty z PDF w załączniku. Rozwiązanie: generowanie pliku `.eml` (RFC 822, `X-Unsent: 1`) z PDF jako MIME attachment base64. User pobiera .eml → otwiera w Outlooku → PDF już w załączniku, pusty temat/treść do uzupełnienia.

---

## Pliki do zmiany

### NOWE pliki

| Plik | Agent | Opis |
|------|-------|------|
| `src/lib/services/eml/eml-builder.service.ts` | Backend | Builder .eml RFC 822 z PDF attachment |
| `src/lib/services/pdf/pdf-data-resolver.ts` | Backend | Ekstrakcja logiki resolwowania NIP+krajów z `pdf.ts` |
| `src/lib/services/eml/__tests__/eml-builder.service.test.ts` | Tester | Testy eml-builder |

### MODYFIKOWANE pliki

| Plik | Agent | Opis zmian |
|------|-------|------------|
| `src/types.ts` (L356-362) | Types | Usunięcie `PrepareEmailResponseDto` (nie będzie JSON response na success) |
| `src/lib/services/order-misc.service.ts` (L9, L20-23, L223-330) | Backend | Zmiana `prepareEmailForOrder`: generuje PDF + .eml, zwraca `emlContent` zamiast `emailOpenUrl` |
| `src/pages/api/v1/orders/[orderId]/prepare-email.ts` (L79) | Backend | Response: blob `message/rfc822` zamiast `jsonResponse()` |
| `src/pages/api/v1/orders/[orderId]/pdf.ts` (L37-93) | Backend | Refactor: użyj `resolvePdfData()` zamiast inline kodu |
| `src/hooks/useOrderDrawer.ts` (L594-609) | Frontend | `api.postRaw()` + blob download .eml (wzorzec z `handleGeneratePdf` L575-592) |
| `src/hooks/useOrderActions.ts` (L93-110) | Frontend | Identyczna zmiana jak useOrderDrawer |

### BEZ ZMIAN (reuse as-is)

- `src/lib/services/pdf/pdf-generator.service.ts` — `generateOrderPdf()` wywoływane z serwisu
- `src/lib/api-client.ts` — `api.postRaw()` + obsługa błędów raw mode (L134-143)
- `src/components/orders/drawer/DrawerFooter.tsx` — przycisk UI bez zmian
- `src/components/orders/drawer/OrderDrawer.tsx` — warunkowe renderowanie bez zmian
- `src/lib/validators/order.validator.ts` — `prepareEmailSchema` bez zmian

---

## Implementacja krok po kroku

### Faza 1: Types agent

**`src/types.ts`** — usunięcie `PrepareEmailResponseDto` (L355-362) i `PrepareEmailCommand` (L351-353). Te interfejsy nie będą potrzebne — success response to blob, nie JSON.

### Faza 2: Backend agent

#### 2a. Nowy: `src/lib/services/pdf/pdf-data-resolver.ts`

Ekstrakcja logiki z `pdf.ts` L37-93 do reużywalnej funkcji:

```ts
export async function resolvePdfData(
  supabase: SupabaseClient<Database>,
  detail: OrderDetailDto
): Promise<GeneratePdfInput>
```

- Pobiera NIP firmy transportowej z tabeli `companies`
- Rozwiązuje kraje stopów z tabeli `locations`
- Buduje `GeneratePdfInput` (order, stops, items)
- Używane przez `pdf.ts` i `prepareEmailForOrder`

#### 2b. Nowy: `src/lib/services/eml/eml-builder.service.ts`

```ts
export function buildEmlWithPdfAttachment(options: {
  pdfBuffer: ArrayBuffer;
  pdfFileName: string;
}): string
```

- Format: RFC 822, MIME `multipart/mixed`
- Nagłówek `X-Unsent: 1` — Outlook otwiera jako draft (compose mode)
- `Subject:` pusty (wg decyzji użytkownika)
- Body: pusty `text/plain`
- Załącznik: PDF jako `base64`, łamany co 76 znaków (RFC 2045)
- `Buffer.from(pdfBuffer).toString("base64")` — Node.js server-side
- Zero zewnętrznych zależności

#### 2c. Modyfikacja: `src/lib/services/order-misc.service.ts`

Zmiana typu i logiki `prepareEmailForOrder()`:

```ts
// Nowy typ (zamienia stary PrepareEmailResult)
export type PrepareEmailResult =
  | { success: true; emlContent: string; orderNo: string }
  | { success: false; validationErrors: string[] }
  | null;
```

Po walidacji i zmianie statusu (L267-315, bez zmian), zamiast budowania `mailto:` URL:
1. `resolvePdfData(supabase, detail)` → `GeneratePdfInput`
2. `generateOrderPdf(input)` → `ArrayBuffer`
3. `buildEmlWithPdfAttachment({ pdfBuffer, pdfFileName })` → `string`
4. Return `{ success: true, emlContent, orderNo }`

Usunięcie importu `PrepareEmailResponseDto`.

#### 2d. Modyfikacja: `src/pages/api/v1/orders/[orderId]/prepare-email.ts`

Zmiana success response (L79):

```ts
// Było: return jsonResponse(result.data, 200);
// Teraz:
const sanitizedName = (result.orderNo || orderId).replace(/["\r\n/]/g, "-");
const fileName = `zlecenie-${sanitizedName}.eml`;
return new Response(result.emlContent, {
  status: 200,
  headers: {
    ...COMMON_HEADERS,
    "Content-Type": "message/rfc822",
    "Content-Disposition": `attachment; filename="${fileName}"`,
  },
});
```

Obsługa błędów (422, 400, 409, 404) — JSON, **bez zmian**.

#### 2e. Refactor: `src/pages/api/v1/orders/[orderId]/pdf.ts`

Zastąpienie inline kodu L37-93 wywołaniem `resolvePdfData()`. Logika identyczna, mniej kodu.

### Faza 3: Frontend agent (równolegle z Faza 4)

#### 3a. `src/hooks/useOrderDrawer.ts` (L594-609)

Wzorzec: skopiuj `handleGeneratePdf` (L575-592), zmień endpoint i rozszerzenie:

```ts
const handleSendEmailFromDrawer = useCallback(async () => {
  if (!orderId) return;
  try {
    const response = await api.postRaw(`/api/v1/orders/${orderId}/prepare-email`, {});
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zlecenie-${(detail?.order.orderNo ?? orderId).replace(/\//g, "-")}.eml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Plik .eml pobrany — otwórz go w programie pocztowym.");
    onOrderUpdated();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Błąd przygotowania maila.");
  }
}, [orderId, detail, api, onOrderUpdated]);
```

Usunięcie importu `PrepareEmailResponseDto`.

#### 3b. `src/hooks/useOrderActions.ts` (L93-110)

Identyczna zmiana. Usunięcie importu `PrepareEmailResponseDto`, zamiana `api.post` → `api.postRaw` + blob download. Zamiast `onOrderUpdated` → `refetch()`.

### Faza 4: Tester agent (równolegle z Faza 3)

#### 4a. Nowy: `src/lib/services/eml/__tests__/eml-builder.service.test.ts`

Testy `buildEmlWithPdfAttachment()`:
- Zawiera `X-Unsent: 1`
- Zawiera `MIME-Version: 1.0`
- Zawiera `Content-Type: multipart/mixed; boundary=`
- Zawiera `Content-Type: application/pdf` w attachment
- Base64 łamany co 76 znaków
- Pusty Subject
- Pusty body text/plain
- Poprawne boundary (otwierające + zamykające `--`)

### Faza 5: Reviewer (opcjonalnie)

Code review całości zmian.

---

## Kolejność agentów

```
1. Types agent        — usunięcie PrepareEmailResponseDto
2. Backend agent      — eml-builder, pdf-data-resolver, modyfikacja serwisu + endpointów
3. Frontend agent  }  — zmiana handlerów (postRaw + blob download)
   Tester agent    }  — testy eml-builder (równolegle)
4. Reviewer agent     — code review (opcjonalnie)
```

---

## Decyzje użytkownika

- **Temat maila:** Pusty (na razie, w przyszłości do zmiany)
- **Lokalizacja przycisku:** Bez zmian — Drawer + Context menu
- **Walidacja UX:** Toast z listą brakujących pól
- **Metoda:** Plik .eml jako fallback; główny flow: Microsoft Graph API (sesja 46)

---

## Weryfikacja

1. **Build**: `npm run build` — zero błędów TypeScript
2. **Testy**: `npm run test` — nowe testy eml-builder przechodzą
3. **Manualne**: klik "Wyślij maila" w drawerze → pobiera `.eml` → otwarcie w Outlooku → PDF w załączniku, pusty temat/treść
4. **Walidacja**: klik na niekompletnym zleceniu → toast z listą brakujących pól (422 JSON)
5. **Status**: po pobraniu .eml → status zmieniony (robocze→wysłane, korekta→korekta wysłane)
6. **Context menu**: "Wyślij email" z tabeli → ten sam flow co drawer

---

## Aktualizacja: Microsoft Graph API integration (sesja 46)

### Kontekst

Dotychczasowy flow (pobieranie .eml) wymaga ręcznego otwarcia pliku w kliencie poczty. Nowy flow wykorzystuje Microsoft Graph API do tworzenia draftu wiadomości bezpośrednio w Outlook Web, co eliminuje krok pośredni.

### Nowy flow (Graph API — główny)

Gdy skonfigurowane zmienne środowiskowe `PUBLIC_MICROSOFT_CLIENT_ID` i `PUBLIC_MICROSOFT_TENANT_ID`:

1. Frontend wysyła `POST /prepare-email` z `outputFormat: "pdf-base64"`
2. Backend: walidacja + zmiana statusu + generacja PDF → zwraca JSON `{ pdfBase64, pdfFileName }`
3. Frontend: uzyskuje token MSAL (popup logowania M365, scope `Mail.ReadWrite`)
4. Frontend: `POST https://graph.microsoft.com/v1.0/me/messages` — tworzy draft z fileAttachment (PDF base64)
5. Frontend: `window.open(webLink)` — otwiera Outlook Web z draftem do edycji
6. Użytkownik uzupełnia adresatów, temat, treść i wysyła wiadomość

### Fallback (.eml — bez zmian)

Gdy brak konfiguracji M365 → stary flow: `POST /prepare-email` (domyślnie `outputFormat: "eml"`) → blob download .eml.

### Nowe pliki

| Plik | Opis |
|------|------|
| `src/lib/microsoft-auth.ts` | MSAL `PublicClientApplication` config (clientId, tenantId, redirect) |
| `src/lib/graph-mail.ts` | `createGraphDraft()` — POST /me/messages z fileAttachment, zwraca webLink |
| `src/contexts/MicrosoftAuthContext.tsx` | `MicrosoftAuthProvider` + hook `useMicrosoftAuth()` (isConfigured, getToken) |

### Zmodyfikowane pliki

| Plik | Zmiana |
|------|--------|
| `src/lib/validators/order.validator.ts` | `prepareEmailSchema` += `outputFormat: z.enum(["eml", "pdf-base64"]).default("eml")` |
| `src/lib/services/order-misc.service.ts` | `PrepareEmailResult` union z format `"eml"` / `"pdf-base64"` |
| `src/pages/api/v1/orders/[orderId]/prepare-email.ts` | Rozgałęzienie odpowiedzi: blob .eml vs JSON `{ pdfBase64, pdfFileName }` |
| `src/hooks/useOrderActions.ts` | Graph API flow z popup blocker workaround (pre-open window) |
| `src/hooks/useOrderDrawer.ts` | Graph API flow z popup blocker workaround |
| `src/components/orders/OrdersApp.tsx` | `MicrosoftAuthProvider` wrapper |
| `.env.example` | `PUBLIC_MICROSOFT_CLIENT_ID`, `PUBLIC_MICROSOFT_TENANT_ID` |

### Popup blocker workaround

Przeglądarki blokują `window.open()` gdy nie jest wywołane bezpośrednio z handlera kliknięcia. Ponieważ między kliknięciem a uzyskaniem `webLink` jest kilka async operacji (prepare-email, MSAL login, Graph API), workaround polega na:
1. `const popup = window.open("about:blank")` — natychmiast w handlerze kliknięcia
2. Po uzyskaniu webLink: `popup.location.href = webLink`
3. Jeśli popup zablokowany → fallback na `window.open(webLink)` z komunikatem toast
