import { useEffect } from "react";
import { GraduationCap } from "lucide-react";
import { useDocentStore } from "@/store/useDocentStore";
import { UploadScreen } from "@/features/documents/UploadScreen";
import { SessionScreen } from "@/features/voice/SessionScreen";

export default function App() {
  const init = useDocentStore((s) => s.init);
  const phase = useDocentStore((s) => s.phase);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <GraduationCap className="h-5 w-5" />
        <h1 className="text-sm font-semibold tracking-tight">Docent</h1>
        <span className="text-xs text-muted-foreground">learn your documents by voice</span>
      </header>
      <main className="min-h-0 flex-1">
        {phase === "upload" ? <UploadScreen /> : <SessionScreen />}
      </main>
    </div>
  );
}
