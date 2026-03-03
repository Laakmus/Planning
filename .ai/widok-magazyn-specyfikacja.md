# Specyfikacja widoku tygodniowego dla magazynu
## Projekt: Odylion Sp. z o.o. Sp. k. – Aplikacja planowania transportów

---

## 1. Cel widoku

Nowy widok tygodniowy dedykowany pracownikom magazynu poszczególnych oddziałów firmy Odylion. Zastępuje konieczność korzystania z głównego widoku planistycznego — prezentuje wyłącznie dane istotne dla magazynu: zaplanowane załadunki i rozładunki dla konkretnego oddziału w danym tygodniu.

---

## 2. Dostęp i role

- Widok dostępny dla ról: **ADMIN**, **PLANNER**, **READ_ONLY**
- Widok jest **tylko do odczytu** — brak możliwości edycji, zmiany statusów ani żadnych interakcji ze zleceniami
- Każdy użytkownik widzi **wyłącznie dane swojego oddziału** — oddział przypisany jest do konta użytkownika w systemie
- Brak możliwości przełączania się między oddziałami przez użytkownika

---

## 3. Nawigacja i nagłówek widoku

### 3.1 Nagłówek tygodnia
Nagłówek wyświetla aktualnie przeglądany tydzień w formacie:
```
Tydzień 12 | 17.03 – 21.03.2025
```

### 3.2 Nawigacja między tygodniami
- Strzałka **◀ wstecz** – przejście do poprzedniego tygodnia
- Strzałka **▶ dalej** – przejście do następnego tygodnia
- **Pole numeryczne** – użytkownik może wpisać numer tygodnia bezpośrednio, aby przejść do wybranego tygodnia (np. wpisanie `15` przenosi do tygodnia 15)

---

## 4. Struktura widoku

### 4.1 Zakres tygodnia
- Widok obejmuje wyłącznie **dni robocze: Poniedziałek – Piątek** (5 wierszy)
- Weekend nie jest wyświetlany

### 4.2 Układ tabeli
Widok ma formę tabeli, gdzie:
- **Każdy wiersz = jeden dzień roboczy**
- **Każdy wiersz podzielony jest na dwie sekcje:**
  - **Lewa strona** → Załadunki (transporty wyjeżdżające z oddziału)
  - **Prawa strona** → Rozładunki (transporty przyjeżdżające do oddziału)
- Wysokość wiersza jest **dynamiczna** — dostosowuje się do liczby asortymentów i transportów w danym dniu

### 4.3 Kolumny tabeli

| # | Nazwa kolumny | Opis |
|---|--------------|------|
| 1 | **Dzień + data** | Nazwa dnia tygodnia (np. Poniedziałek) + data w formacie DD.MM.YYYY |
| 2 | **Nr zlecenia** | Numer zlecenia transportowego z głównego widoku planistycznego |
| 3 | **Godzina załadunku** | Godzina załadunku dla danego transportu |
| 4 | **Towar** | Lista asortymentów (do 15 pozycji) — każda pozycja w nowej linii + podsumowanie łącznej masy w tonach |
| 5 | **Firma transportowa** | Nazwa firmy przewoźnika |
| 6 | **Dane do awizacji** | Pełne dane do awizacji (szczegóły poniżej) |

> ⚠️ Kolumna **statusu zlecenia nie jest wyświetlana** w tym widoku.

---

## 5. Szczegóły kolumn

### 5.1 Kolumna „Dzień + data"
- Format: `Poniedziałek 17.03.2025`
- Wszystkie dni wyglądają tak samo — brak wyróżnienia wizualnego bieżącego dnia

### 5.2 Kolumna „Towar"
- Każdy asortyment wyświetlany w **nowej linii**
- Liczba linii = liczba asortymentów (max 15)
- Na końcu listy **podsumowanie łącznej masy**, np.:
  ```
  Złom miedzi – bigbag
  Złom aluminium – luzem
  Makulatura – paleta
  ─────────────────
  Razem: 24,5 t
  ```
- Wysokość komórki rozrasta się dynamicznie wraz z liczbą pozycji

### 5.3 Kolumna „Dane do awizacji"
Zawiera następujące dane, każda w nowej linii:
- Imię i nazwisko kierowcy
- Nr rejestracyjny **ciągnika**
- Nr rejestracyjny **przyczepy**
- Nr telefonu do kierowcy
- Nr **BDO**

Przykład:
```
Jan Kowalski
Ciągnik: WA 12345
Przyczepa: WA 67890
Tel: +48 600 000 000
BDO: 000123456
```

---

## 6. Filtrowanie danych

### 6.1 Widoczne statusy zleceń
W widoku magazynowym wyświetlane są zlecenia o następujących statusach:
- **Robocze**
- **Wysłane**
- **Korekta**
- **Korekta wysłane**

Zlecenia o statusach: *Zrealizowane*, *Anulowane*, *Reklamacja* — **nie są wyświetlane**.

### 6.2 Filtrowanie po oddziale
- Wyświetlane są wyłącznie zlecenia, w których dany oddział występuje jako **miejsce załadunku lub rozładunku**
- Oddział przypisany jest automatycznie na podstawie konta użytkownika

---

## 7. Źródło danych

- Wszystkie dane pobierane są **z głównego widoku planistycznego** (bez duplikowania logiki)
- Integracja z istniejącą bazą danych PostgreSQL / Supabase
- Dane słownikowe (przewoźnicy, towary, miejsca) pobierane z ERP — bez osobnej synchronizacji dla tego widoku

---

## 8. Wymagania techniczne (informacyjnie)

- Frontend: **Astro + React + TypeScript + Tailwind CSS**
- Widok dostępny w przeglądarce Chrome na laptopach
- Nagłówek tabeli (nazwy kolumn) oraz nagłówek tygodnia — **sticky** przy przewijaniu
- Tabela przewija się w pionie; na wąskich ekranach możliwy poziomy scroll z paskiem u dołu
- Widok tylko do odczytu — brak event handlerów edycji, brak modali

---

## 9. Ścieżka URL (propozycja)

```
/warehouse/:oddzialId/week/:weekNumber
```

Przykład: `/warehouse/krakow/week/12`

---

## 10. Podsumowanie decyzji projektowych

| Temat | Decyzja |
|-------|---------|
| Kto używa | ADMIN, PLANNER, READ_ONLY – wszyscy jako read-only |
| Wybór oddziału | Automatycznie z konta użytkownika |
| Zakres tygodnia | Pon–Pt (5 dni roboczych) |
| Nawigacja | Strzałki + pole z nr tygodnia |
| Układ dnia | Dwie sekcje: lewa = załadunki, prawa = rozładunki |
| Kliknięcie transportu | Brak akcji – tylko podgląd |
| Format transportu | Tabela z dynamiczną wysokością wierszy |
| Kolumny | Dzień+data, Nr zlecenia, Godzina załadunku, Towar, Firma transportowa, Dane do awizacji |
| Towar | Każdy asortyment w nowej linii + suma ton |
| Dane awizacji | Kierowca, ciągnik, przyczepa, telefon, BDO |
| Wyróżnienie dziś | Brak – wszystkie dni jednolite |
| Nagłówek tygodnia | „Tydzień 12 \| 17.03 – 21.03.2025" |
| Statusy widoczne | Robocze, Wysłane, Korekta, Korekta wysłane |
| Kolumna statusu | Niewidoczna w tym widoku |
