import { useRef } from "react";
import { FileText, Plus, Loader2, X, Mic } from "lucide-react";
import { useDocentStore } from "@/store/useDocentStore";
import { Button } from "@/components/ui/button";

export function UploadScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const docs = useDocentStore((s) => s.docs);
  const busy = useDocentStore((s) => s.busy);
  const error = useDocentStore((s) => s.error);
  const addPdf = useDocentStore((s) => s.addPdf);
  const removeDoc = useDocentStore((s) => s.removeDoc);
  const startSession = useDocentStore((s) => s.startSession);
  const clearError = useDocentStore((s) => s.clearError);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) await addPdf(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Docent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your documents. The tutor teaches all of them, by voice, and tracks how well you
          actually understand the material.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{doc.title}</span>
            <button
              onClick={() => removeDoc(doc.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${doc.title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add PDF{docs.length ? "s" : ""}
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

      {error && (
        <button
          onClick={clearError}
          className="rounded-md border border-border bg-muted px-3 py-2 text-left text-xs text-muted-foreground"
        >
          {error} — tap to dismiss
        </button>
      )}

      <Button size="lg" disabled={busy || docs.length === 0} onClick={startSession} className="h-12">
        <Mic className="h-5 w-5" />
        Start learning by voice
      </Button>
      {docs.length === 0 && (
        <p className="-mt-3 text-center text-xs text-muted-foreground">Add at least one PDF to begin.</p>
      )}
    </div>
  );
}
