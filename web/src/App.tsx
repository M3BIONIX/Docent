import { useEffect } from "react";
import { GraduationCap, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { AdminApp } from "@/features/admin/AdminApp";
import { SessionScreen } from "@/features/voice/SessionScreen";
import { Button } from "@/components/ui/button";

export default function App() {
  const init = useAuth((s) => s.init);
  const loading = useAuth((s) => s.loading);
  const me = useAuth((s) => s.me);
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    void init();
  }, [init]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
      </div>
    );
  }

  if (!me) return <LoginScreen />;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <GraduationCap className="h-5 w-5" />
        <h1 className="text-sm font-semibold tracking-tight">Docent</h1>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {me.user.role}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{me.user.name || me.user.email}</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        {me.user.role === "admin" ? <AdminApp /> : <SessionScreen />}
      </main>
    </div>
  );
}
