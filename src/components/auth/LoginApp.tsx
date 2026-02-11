import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginCard } from "./LoginCard";

/**
 * Inner component that checks auth state.
 * If already authenticated, redirects to /orders.
 * Otherwise, shows the login form.
 */
function LoginContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // If already logged in, redirect immediately
  if (isAuthenticated && !isLoading) {
    window.location.href = "/orders";
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Przekierowywanie...</p>
      </div>
    );
  }

  // Show loading spinner while checking session
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginCard />
    </div>
  );
}

/**
 * React island for the login page (/).
 * Wraps LoginCard with AuthProvider.
 */
export default function LoginApp() {
  return (
    <AuthProvider>
      <LoginContent />
    </AuthProvider>
  );
}
