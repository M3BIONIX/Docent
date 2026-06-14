import { useEffect, useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import {
  adminListUsers,
  adminCreateLearner,
  adminListDocuments,
  adminGetAssignments,
  adminSetAssignments,
  type AdminUser,
  type DocMeta,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function initials(u: AdminUser): string {
  const base = (u.name || u.email).trim();
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base.slice(0, 2).toUpperCase();
}

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [adding, setAdding] = useState(false);

  const refreshUsers = () => adminListUsers().then(setUsers).catch((e) => setError(e.message));
  useEffect(() => {
    void refreshUsers();
    void adminListDocuments().then(setDocs).catch(() => undefined);
  }, []);

  const selectUser = async (u: AdminUser) => {
    setSelected(u);
    if (u.role === "learner") {
      const ids = await adminGetAssignments(u.id);
      setAssigned(new Set(ids));
    }
  };

  const toggle = (docId: string) => {
    setAssigned((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminSetAssignments(selected.id, [...assigned]);
      await refreshUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await adminCreateLearner(form);
      setForm({ name: "", email: "", password: "" });
      setShowAdd(false);
      await refreshUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create learner");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex gap-8">
      {/* learners */}
      <div className="flex w-[320px] shrink-0 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-medium">Learners</h2>
            <span className="text-[13px] text-muted-foreground">{users.length}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAdd((s) => !s)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {showAdd && (
          <form onSubmit={addLearner} className="flex flex-col gap-2 rounded-md border border-border p-3">
            {(["name", "email", "password"] as const).map((field) => (
              <input
                key={field}
                type={field === "password" ? "password" : field === "email" ? "email" : "text"}
                placeholder={field[0]!.toUpperCase() + field.slice(1)}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required
                className="h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
              />
            ))}
            <Button type="submit" size="sm" disabled={adding}>
              {adding && <Loader2 className="h-4 w-4 animate-spin" />} Create
            </Button>
          </form>
        )}

        <div className="flex flex-col gap-0.5">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => selectUser(u)}
              className={cn(
                "flex h-14 items-center gap-3 rounded-md px-2.5 text-left transition-colors hover:bg-muted",
                selected?.id === u.id && "bg-muted",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-medium text-background">
                {initials(u)}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{u.name || u.email}</span>
                <span className="truncate text-xs text-muted-foreground">{u.email}</span>
              </div>
              {u.role === "learner" && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{u.doc_count} docs</span>
              )}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </div>

      {/* assignment panel */}
      <div className="flex flex-1 flex-col gap-5">
        {!selected || selected.role === "admin" ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-10 text-center text-[13px] text-muted-foreground">
            Select a learner to choose which documents they study.
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">Documents for {selected.name || selected.email}</h2>
                <p className="text-[13px] text-muted-foreground">
                  Choose which documents this learner can study by voice
                </p>
              </div>
              <Button disabled={saving} onClick={saveAssignments} className="h-10">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              {docs.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                  Upload documents first (Documents tab).
                </p>
              )}
              {docs.map((d, i) => {
                const on = assigned.has(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => toggle(d.id)}
                    className={cn(
                      "flex h-16 w-full items-center gap-3.5 px-4 text-left",
                      i > 0 && "border-t border-border/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px]",
                        on ? "bg-foreground text-background" : "border border-muted-foreground/50",
                      )}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{d.title}</span>
                      <span className="text-xs text-muted-foreground">{d.chunk_count ?? 0} sections</span>
                    </div>
                    <span className={cn("ml-auto text-[13px]", on ? "" : "text-muted-foreground")}>
                      {on ? "Assigned" : "Not assigned"}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
