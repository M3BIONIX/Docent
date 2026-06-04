import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Play } from "lucide-react";
import { useDocentStore } from "@/store/useDocentStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ChatPanel() {
  const activeDocId = useDocentStore((s) => s.activeDocId);
  const messages = useDocentStore((s) => s.messages);
  const streamingText = useDocentStore((s) => s.streamingText);
  const busy = useDocentStore((s) => s.busy);
  const error = useDocentStore((s) => s.error);
  const sendMessage = useDocentStore((s) => s.sendMessage);
  const beginSession = useDocentStore((s) => s.beginSession);
  const clearError = useDocentStore((s) => s.clearError);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText]);

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
  };

  if (!activeDocId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Pick a document to begin learning.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streamingText && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">Ready when you are.</p>
            <Button onClick={beginSession} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start teaching
            </Button>
          </div>
        )}

        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} />
        ))}
        {streamingText && <Bubble role="assistant" text={streamingText} streaming />}
      </div>

      {error && (
        <button
          onClick={clearError}
          className="mx-4 mb-2 rounded-md border border-border bg-muted px-3 py-2 text-left text-xs text-muted-foreground"
        >
          {error} — tap to dismiss
        </button>
      )}

      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          placeholder="Answer, or ask about this document…"
          rows={1}
          disabled={busy}
        />
        <Button size="icon" onClick={onSend} disabled={busy || !input.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function Bubble({
  role,
  text,
  streaming,
}: {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-card-foreground",
        )}
      >
        {text}
        {streaming && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
      </div>
    </div>
  );
}
