/**
 * LoginCard — formularz logowania (username + hasło).
 *
 * Wyświetlany na stronie / jako React island (client:load).
 * Po pomyślnym logowaniu przekierowuje na /orders.
 *
 * Logowanie odbywa się przez POST /api/v1/auth/login (username → email → GoTrue),
 * a nie bezpośrednio przez supabase.auth.signInWithPassword.
 */

import { useState, type FormEvent } from "react";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { loginUsernameSchema } from "@/lib/validators/auth.validator";

// ---------------------------------------------------------------------------
// Formularz wewnętrzny (wymaga AuthProvider wyżej w drzewie)
// ---------------------------------------------------------------------------

function LoginForm() {
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Walidacja client-side (username + hasło) zgodna z backendem
    const parsed = loginUsernameSchema.safeParse({
      username: username.trim(),
      password,
    });
    if (!parsed.success) {
      // Pokazujemy generyczny komunikat — nie zdradzamy szczegółów walidacji
      const firstIssue = parsed.error.issues[0];
      setError(firstIssue?.message ?? "Podaj login i hasło.");
      return;
    }

    setIsLoading(true);
    try {
      await login(parsed.data.username, parsed.data.password);
      // Po pomyślnym logowaniu — przekieruj
      window.location.href = "/orders";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Błąd logowania. Spróbuj ponownie.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            System Zleceń Transportowych
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Zaloguj się, aby kontynuować
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
          <div className="space-y-2">
            <Label htmlFor="username">Login</Label>
            <Input
              id="username"
              type="text"
              placeholder="np. j.kowalski"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              data-testid="login-username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              type="password"
              placeholder="Wprowadź hasło"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              data-testid="login-password"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive" data-testid="login-error">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            data-testid="login-submit"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logowanie...
              </>
            ) : (
              "Zaloguj"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eksport z AuthProvider (samodzielna wyspa React)
// ---------------------------------------------------------------------------

interface LoginCardProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function LoginCard({
  supabaseUrl,
  supabaseAnonKey,
}: LoginCardProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
        <LoginForm />
      </AuthProvider>
    </ThemeProvider>
  );
}
