import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { VoiceOrb } from "@/features/voice/VoiceOrb";

const idleLevel = () => 0;

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
    <div className="flex h-screen w-full bg-background">
      {/* Form pane */}
      <div className="flex w-full flex-col items-center justify-center px-12 lg:w-[560px] lg:shrink-0">
        <form onSubmit={submit} className="flex w-full max-w-[320px] flex-col gap-5">
          <Logo />
          <div className="mt-2 flex flex-col gap-1">
            <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Continue to your learning sessions.</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px]">Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="alex@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-md border border-border bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px]">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 rounded-md border border-border bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
            />
          </label>
          {error && <p className="text-xs text-muted-foreground">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-1 h-11">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </Button>
          <p className="text-center text-[13px] text-muted-foreground">
            Having trouble? Contact your administrator.
          </p>
        </form>
      </div>

      {/* Brand pane */}
      <div className="hidden flex-1 flex-col items-center justify-center gap-9 bg-[#0a0a0a] lg:flex">
        <VoiceOrb getLevel={idleLevel} active={false} speaking={false} size={260} />
        <div className="flex max-w-[420px] flex-col items-center gap-3 px-8 text-center">
          <h2 className="text-3xl font-medium leading-tight tracking-tight text-white">
            Understand it. Out loud.
          </h2>
          <p className="text-[15px] leading-relaxed text-neutral-400">
            Docent teaches your documents by voice and measures real understanding — not whether you
            nodded along.
          </p>
        </div>
      </div>
    </div>
  );
}
