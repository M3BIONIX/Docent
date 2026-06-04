import { useDocentStore } from "@/store/useDocentStore";
import { Progress } from "@/components/ui/progress";

export function ScorePanel() {
  const docs = useDocentStore((s) => s.docs);
  const scores = useDocentStore((s) => s.scores);
  const ready = docs.filter((d) => d.status === "ready");

  if (ready.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-tight">Understanding</h2>
      <div className="flex flex-col gap-3">
        {ready.map((doc) => {
          const score = scores[doc.id];
          const value = score?.understanding ?? 0;
          return (
            <div key={doc.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">{doc.title}</span>
                <span className="tabular-nums">{score?.mastered ? "mastered" : `${value}%`}</span>
              </div>
              <Progress value={value} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
