/**
 * Schematy Zod dla autoryzacji i panelu admina.
 *
 * Obejmuje:
 *  - logowanie przez username + hasło
 *  - CRUD userów (create / update / reset password)
 *  - aktywację konta przez invite token
 */

import { z } from "zod";

/**
 * Username — małe litery, cyfry oraz znaki `.`, `_`, `-` (3–32 znaki).
 * Transform `.toLowerCase()` gwarantuje spójność w DB (case-insensitive login).
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Username: 3–32 znaki (małe litery, cyfry, . _ -)");

/**
 * Hasło — pragmatyczne wymagania: min 8 znaków, co najmniej 1 litera i 1 cyfra.
 * Bez wymogów dot. znaków specjalnych / wielkich liter (zbyt restrykcyjne dla zespołu).
 */
export const passwordSchema = z
  .string()
  .min(8, "Hasło musi mieć min 8 znaków")
  .max(128, "Hasło zbyt długie (max 128 znaków)")
  .refine((v) => /[A-Za-z]/.test(v), "Hasło musi zawierać literę")
  .refine((v) => /\d/.test(v), "Hasło musi zawierać cyfrę");

/** Dozwolone role użytkownika (lustro `UserRole` z common.ts). */
const userRoleSchema = z.enum(["ADMIN", "PLANNER", "READ_ONLY"]);

/**
 * Schema hasła dla LOGOWANIA — tylko minimalna sanityzacja (non-empty, max length).
 * NIE wymuszamy siły hasła przy loginie, bo legacy userzy mogą mieć słabsze hasła
 * niż wymagane teraz przy create/reset (passwordSchema). Walidacja siły tu tylko
 * blokuje legitnych userów; faktyczna weryfikacja dzieje się w Supabase
 * `signInWithPassword`.
 */
const loginPasswordSchema = z
  .string()
  .min(1, "Hasło jest wymagane")
  .max(128, "Hasło zbyt długie (max 128 znaków)");

/** POST /api/v1/auth/login — logowanie przez username. */
export const loginUsernameSchema = z.object({
  username: usernameSchema,
  password: loginPasswordSchema,
});

/** POST /api/v1/admin/users — tworzenie usera przez admina. */
export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  email: z.string().trim().email("Nieprawidłowy email").max(200),
  fullName: z.string().trim().min(1, "Imię i nazwisko wymagane").max(200),
  phone: z.string().trim().max(30).optional(),
  role: userRoleSchema,
});

/**
 * PATCH /api/v1/admin/users/:id — aktualizacja usera.
 * Username i hasło pomijane (username niezmienialny, hasło przez reset-password).
 */
export const updateUserSchema = createUserSchema
  .partial()
  .omit({ username: true, password: true })
  .extend({
    isActive: z.boolean().optional(),
  });

/** POST /api/v1/admin/users/:id/reset-password — reset hasła przez admina. */
export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

/**
 * POST /api/v1/auth/activate — aktywacja konta przez invite token.
 * Token generowany po stronie serwera (hex / base64url), 32–128 znaków.
 */
export const activateAccountSchema = z.object({
  token: z.string().min(32).max(128),
});

/** Typy wywnioskowane z schematów (pomocne w handlerach API). */
export type LoginUsernameInput = z.infer<typeof loginUsernameSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;
