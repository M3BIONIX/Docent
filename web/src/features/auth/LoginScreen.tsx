import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { Button } from "@/components/ui/button";

export function LoginScreen() {
  const login = useAuth((s) => s.login);
  const error = useAuth((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await login(email.trim(), password);
    setBusy(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background px-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <GraduationCap className="h-7 w-7" />
          <h1 className="text-xl font-semibold tracking-tight">Docent</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-10 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="h-10 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        />
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        <Button type="submit" disabled={busy} className="h-10">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>
    </div>
  );
}
