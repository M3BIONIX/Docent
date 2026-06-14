import { useEffect, useRef, useState } from "react";
import { FileText, UploadCloud, Loader2, Trash2 } from "lucide-react";
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
        setStatus(`Indexing ${file.name}…`);
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
    <div className="flex flex-col gap-5">
      {/* toolbar */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">Documents</h2>
          <p className="text-[13px] text-muted-foreground">
            {docs.length} indexed · upload once here, then assign under Users &amp; access
          </p>
        </div>
        <Button disabled={busy} onClick={() => inputRef.current?.click()} className="h-[42px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Upload PDF
        </Button>
        <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onPick} />
      </div>

      {/* dropzone */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/50 transition-colors hover:bg-muted"
      >
        <span className="flex items-center gap-2 text-sm">
          <UploadCloud className="h-4 w-4" /> {status ?? "Drag a PDF here, or click to browse"}
        </span>
        <span className="text-xs text-muted-foreground">
          We extract the text and index it for voice teaching
        </span>
      </button>

      {error && <p className="text-xs text-muted-foreground">{error}</p>}

      {/* table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex h-11 items-center bg-muted/60 px-4 text-xs text-muted-foreground">
          <span className="flex-1">Document</span>
          <span className="w-[120px]">Sections</span>
          <span className="w-[120px]">Status</span>
          <span className="w-12" />
        </div>
        {docs.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">No documents yet.</p>
        )}
        {docs.map((d) => (
          <div key={d.id} className="flex h-[60px] items-center border-t border-border/60 px-4">
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <FileText className="h-[17px] w-[17px]" />
              </div>
              <span className="truncate text-sm font-medium">{d.title}</span>
            </div>
            <span className="w-[120px] text-sm text-muted-foreground">{d.chunk_count ?? 0}</span>
            <span className="w-[120px] text-sm">{d.chunk_count ? "Indexed" : "Empty"}</span>
            <div className="flex w-12 justify-end">
              <button onClick={() => remove(d.id)} className="text-muted-foreground hover:text-foreground">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
