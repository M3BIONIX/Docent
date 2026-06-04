import { useEffect } from "react";
import { GraduationCap } from "lucide-react";
import { useDocentStore } from "@/store/useDocentStore";
import { DocumentsPanel } from "@/features/documents/DocumentsPanel";
import { DocViewer } from "@/features/documents/DocViewer";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { ScorePanel } from "@/features/progress/ScorePanel";

export default function App() {
  const init = useDocentStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <GraduationCap className="h-5 w-5" />
        <h1 className="text-sm font-semibold tracking-tight">Docent</h1>
        <span className="text-xs text-muted-foreground">learn from your documents</span>
      </header>

      <div className="grid flex-1 grid-cols-[260px_1fr_360px] overflow-hidden">
        {/* Left: documents + progress */}
        <aside className="flex flex-col gap-6 overflow-hidden border-r border-border p-4">
          <DocumentsPanel />
          <ScorePanel />
        </aside>

        {/* Middle: the document reading pane */}
        <main className="overflow-hidden border-r border-border">
          <DocViewer />
        </main>

        {/* Right: the tutor chat */}
        <section className="overflow-hidden">
          <ChatPanel />
        </section>
      </div>
    </div>
  );
}
