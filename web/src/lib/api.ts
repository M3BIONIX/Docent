// Same-origin by default ("" -> "/api"), which is what Vercel needs (the SPA and
// the serverless function share an origin). In local dev the Vite proxy forwards
// /api to the standalone server on :4000. Override with VITE_API_ORIGIN only to
// point at a backend on a different host.
const API_BASE = `${import.meta.env.VITE_API_ORIGIN ?? ""}/api`;

export interface TurnVerdict {
  onTrack: boolean;
  shouldEnd: boolean;
  realignmentNote: string | null;
  nextBestQuestion: string | null;
  understandingScore: number | null;
}

export interface TurnRequestBody {
  sessionId: string;
  docId: string;
  intent: { summary: string; openingQuestion: string | null };
  history: { role: "user" | "assistant"; text: string }[];
  latestUserMessage: string;
  context: string[];
}

export interface TurnHandlers {
  onVerdict?: (verdict: TurnVerdict) => void;
  onToken?: (delta: string) => void;
  onDone?: (info: { advanceToNextDoc: boolean }) => void;
  onError?: (err: { code: string; message: string }) => void;
}

/** POST /embed — returns one vector per input text, in order. */
export async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${API_BASE}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.code ? `Embed failed: ${body.code}` : `Embed failed: ${res.status}`);
  }
  const data = (await res.json()) as { vectors: number[][] };
  return data.vectors;
}

/**
 * POST /turn — Server-Sent Events over a fetch stream (EventSource is GET-only).
 * Parses `event:`/`data:` frames and dispatches to handlers.
 */
export async function streamTurn(
  body: TurnRequestBody,
  handlers: TurnHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    handlers.onError?.({ code: "HTTP_ERROR", message: `Turn failed: ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (event: string, data: string) => {
    let parsed: unknown = data;
    try {
      parsed = JSON.parse(data);
    } catch {
      /* keep raw */
    }
    switch (event) {
      case "verdict":
        handlers.onVerdict?.(parsed as TurnVerdict);
        break;
      case "token":
        handlers.onToken?.((parsed as { delta: string }).delta);
        break;
      case "done":
        handlers.onDone?.(parsed as { advanceToNextDoc: boolean });
        break;
      case "error":
        handlers.onError?.(parsed as { code: string; message: string });
        break;
    }
  };

  // SSE frames are separated by a blank line; each has `event:` and `data:` lines.
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) dispatch(event, dataLines.join("\n"));
    }
  }
}
