/**
 * LoginCard — formularz logowania (email + hasło).
 *
 * Wyświetlany na stronie / jako React island (client:load).
 * Po pomyślnym logowaniu przekierowuje na /orders.
 *
 * Komunikaty błędów są generyczne (nie zdradzamy czy konto istnieje).
 */

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Formularz wewnętrzny (wymaga AuthProvider wyżej w drzewie)
// ---------------------------------------------------------------------------

function LoginForm() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Walidacja podstawowa
    if (!email.trim() || !password.trim()) {
      setError("Podaj login i hasło.");
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Login</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@firma.pl"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
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
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
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
    <AuthProvider supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
      <LoginForm />
    </AuthProvider>
  );
}
