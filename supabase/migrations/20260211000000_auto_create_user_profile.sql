-- Automatyczne tworzenie wpisu w user_profiles przy rejestracji użytkownika w Supabase Auth.
-- Dzięki temu po utworzeniu użytkownika w Studio (lub przez signUp) logowanie działa od razu.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'fullName'),
    case
      when (new.raw_user_meta_data->>'role') in ('ADMIN','PLANNER','READ_ONLY')
      then (new.raw_user_meta_data->>'role')
      else 'READ_ONLY'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
