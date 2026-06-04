import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Vite resolves the worker to a URL; point pdf.js at it.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

/** Extract plain text from a PDF file. Throws PdfExtractionError if no text is recoverable. */
export async function extractPdfText(file: File | ArrayBuffer): Promise<string> {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (error) {
    throw new PdfExtractionError(
      `Could not open PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) parts.push(pageText);
  }

  const text = parts.join("\n\n").trim();
  if (!text) {
    throw new PdfExtractionError(
      "This PDF has no extractable text (it may be a scanned image).",
    );
  }
  return text;
}

/** Render a single PDF page to a canvas for the viewer. */
export async function renderPdfPage(
  data: ArrayBuffer,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale = 1.2,
): Promise<number> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(Math.min(Math.max(1, pageNum), doc.numPages));
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PdfExtractionError("Canvas 2D context unavailable");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return doc.numPages;
}
