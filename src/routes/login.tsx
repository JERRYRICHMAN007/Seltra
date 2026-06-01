import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Seltra Ops" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.endsWith("@seltra.co")) {
      setError("Only @seltra.co email addresses are permitted.");
      return;
    }
    setLoading(true);
    const { error } = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setLoading(false);
    if (error) { setError(error.message); return; }
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-card-hover p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold">S</div>
          <div>
            <div className="text-sm font-semibold text-navy">Seltra Ops</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Internal Command Center</div>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-navy">{mode === "signin" ? "Sign in to Seltra Ops" : "Create your account"}</h1>
        <p className="text-xs text-muted-foreground mt-1">Restricted to @seltra.co addresses.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@seltra.co"
            className="w-full h-10 px-3 rounded-md border border-input bg-surface-muted text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-10 px-3 rounded-md border border-input bg-surface-muted text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          {error && <div className="text-xs text-destructive bg-destructive-soft px-3 py-2 rounded-md">{error}</div>}
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-xs text-muted-foreground hover:text-primary w-full text-center">
          {mode === "signin" ? "First time? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
