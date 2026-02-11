# Logowanie do aplikacji

Aby móc się zalogować, muszą być spełnione **trzy warunki**.

## 1. Działający Supabase (lokalnie)

W katalogu projektu uruchom:

```bash
supabase start
```

Po starcie sprawdź, że w pliku `.env` masz (już jest w `.env.example`):

- `PUBLIC_SUPABASE_URL=http://127.0.0.1:54331`
- `PUBLIC_SUPABASE_ANON_KEY=...` (wartość z `supabase start` lub z `.env.example`)

Bez działającego Supabase logowanie zwróci błąd połączenia.

## 2. Zastosowane migracje bazy

Po pierwszym `supabase start` zastosuj migracje:

```bash
supabase db reset
```

(lub `supabase migration up` jeśli nie chcesz czyścić bazy).  
Migracja `20260211000000_auto_create_user_profile.sql` sprawia, że **każdy nowy użytkownik w Auth dostaje automatycznie wpis w `user_profiles`**.

## 3. Użytkownik w Supabase Auth

### Opcja A: Supabase Studio (najprostsza)

1. Otwórz **Supabase Studio**:  
   [http://127.0.0.1:54333](http://127.0.0.1:54333)  
   (adres podany w terminalu po `supabase start`).

2. Przejdź do **Authentication** → **Users** → **Add user** → **Create new user**.

3. Wpisz np.:
   - **Email:** `admin@test.pl`
   - **Password:** dowolne hasło (np. `Test123!`)

4. Zapisz. Dzięki triggerowi w bazie w tabeli `user_profiles` pojawi się wpis z rolą `READ_ONLY`.

5. Aby nadać rolę **ADMIN** lub **PLANNER**, w Studio otwórz **Table Editor** → `user_profiles`, znajdź użytkownika i w kolumnie `role` ustaw `ADMIN` lub `PLANNER`.

### Opcja B: Istniejący użytkownik bez triggera

Jeśli użytkownik został utworzony **przed** dodaniem migracji z triggerem, wpis w `user_profiles` mógł nie powstać. Możesz dodać go ręcznie w **SQL Editor** w Studio:

```sql
-- Zamień YOUR_USER_ID na UUID użytkownika z zakładki Authentication → Users
-- oraz email na prawdziwy email tego użytkownika
insert into public.user_profiles (id, email, full_name, role)
values (
  'YOUR_USER_ID'::uuid,
  'admin@test.pl',
  'Administrator',
  'ADMIN'
)
on conflict (id) do nothing;
```

UUID użytkownika zobaczysz w Authentication → Users (kolumna **UID**).

---

## Podsumowanie – szybki start

```bash
# 1. Uruchom Supabase
supabase start

# 2. Zastosuj migracje (w tym auto-create profilu)
supabase db reset

# 3. W przeglądarce: http://127.0.0.1:54333 → Authentication → Add user
#    (email + hasło)

# 4. Opcjonalnie: Table Editor → user_profiles → ustaw role = ADMIN

# 5. Uruchom aplikację i zaloguj się
npm run dev
# Otwórz http://localhost:4321 i zaloguj się tym samym emailem i hasłem
```

Jeśli nadal nie możesz się zalogować, sprawdź w konsoli przeglądarki (F12 → Network / Console) komunikat błędu (brak połączenia z Supabase, „Invalid login credentials”, czy „Profil użytkownika nie istnieje”).
