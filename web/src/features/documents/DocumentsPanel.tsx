import { useRef } from "react";
import { FileText, Plus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useDocentStore } from "@/store/useDocentStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DocumentsPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const docs = useDocentStore((s) => s.docs);
  const activeDocId = useDocentStore((s) => s.activeDocId);
  const busy = useDocentStore((s) => s.busy);
  const scores = useDocentStore((s) => s.scores);
  const addPdf = useDocentStore((s) => s.addPdf);
  const setActiveDoc = useDocentStore((s) => s.setActiveDoc);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) await addPdf(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Documents</h2>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add PDF
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {docs.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Upload PDFs to start. The tutor will teach them one at a time and track your understanding.
          </p>
        )}
        {docs.map((doc) => {
          const score = scores[doc.id];
          return (
            <button
              key={doc.id}
              onClick={() => doc.status === "ready" && setActiveDoc(doc.id)}
              disabled={doc.status !== "ready"}
              className={cn(
                "flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left text-sm transition-colors",
                doc.status === "ready" && "hover:bg-muted",
                activeDocId === doc.id && "border-border bg-muted",
                doc.status !== "ready" && "opacity-70",
              )}
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{doc.title}</span>
              {doc.status === "ingesting" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {doc.status === "failed" && <AlertCircle className="h-3.5 w-3.5" />}
              {score?.mastered && <CheckCircle2 className="h-3.5 w-3.5" />}
              {doc.status === "ready" && !score?.mastered && score && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {score.understanding}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
