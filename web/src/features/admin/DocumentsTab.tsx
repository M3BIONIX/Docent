import { useEffect, useRef, useState } from "react";
import { FileText, Plus, Loader2, Trash2 } from "lucide-react";
import { extractPdfText } from "@/lib/pdf";
import { adminListDocuments, adminCreateDocument, adminDeleteDocument, type DocMeta } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function DocumentsTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => adminListDocuments().then(setDocs).catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        setStatus(`Reading ${file.name}…`);
        const text = await extractPdfText(file);
        setStatus(`Embedding ${file.name}…`);
        await adminCreateDocument(file.name.replace(/\.pdf$/i, ""), text);
      }
      await refresh();
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await adminDeleteDocument(id);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Documents</h2>
          <p className="text-xs text-muted-foreground">
            Upload PDFs once here, then assign them to learners under Users &amp; Access.
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Upload PDF
        </Button>
        <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onPick} />
      </div>

      {status && <p className="text-xs text-muted-foreground">{status}</p>}
      {error && <p className="text-xs text-muted-foreground">{error}</p>}

      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        {docs.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No documents yet.</p>
        )}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{d.title}</span>
            <span className="text-[11px] text-muted-foreground">{d.chunk_count ?? 0} chunks</span>
            <button onClick={() => remove(d.id)} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
