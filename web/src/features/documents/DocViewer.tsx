import { useMemo } from "react";
import { useDocentStore } from "@/store/useDocentStore";

/**
 * MVP document viewer: a clean reading pane of the extracted text, shown beside
 * the chat so the learner can follow along. (Canvas page rendering via
 * lib/pdf.ts:renderPdfPage is available as a later upgrade.)
 */
export function DocViewer() {
  const activeDocId = useDocentStore((s) => s.activeDocId);
  const docs = useDocentStore((s) => s.docs);
  const doc = useMemo(() => docs.find((d) => d.id === activeDocId), [docs, activeDocId]);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a document to read and learn.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="truncate text-sm font-semibold tracking-tight">{doc.title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <article className="prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {doc.text}
        </article>
      </div>
    </div>
  );
}
