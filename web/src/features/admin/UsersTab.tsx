import { useEffect, useState } from "react";
import { Loader2, UserPlus, Shield, User, Check } from "lucide-react";
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

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // add-learner form
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
    <div className="grid grid-cols-[1fr_1.2fr] gap-6">
      {/* users list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Users</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAdd((s) => !s)}>
            <UserPlus className="h-4 w-4" /> Add learner
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

        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => selectUser(u)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                selected?.id === u.id && "bg-muted",
              )}
            >
              {u.role === "admin" ? (
                <Shield className="h-4 w-4 text-muted-foreground" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">
                {u.name || u.email}
                <span className="ml-1 text-[11px] text-muted-foreground">{u.email}</span>
              </span>
              {u.role === "learner" && (
                <span className="text-[11px] text-muted-foreground">{u.doc_count} docs</span>
              )}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </div>

      {/* assignment panel */}
      <div className="flex flex-col gap-3">
        {!selected || selected.role === "admin" ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Select a learner to choose which documents they learn.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Documents for {selected.name || selected.email}
              </h2>
              <Button size="sm" disabled={saving} onClick={saveAssignments}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </Button>
            </div>
            <div className="flex flex-col divide-y divide-border rounded-md border border-border">
              {docs.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Upload documents first (Documents tab).
                </p>
              )}
              {docs.map((d) => {
                const on = assigned.has(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => toggle(d.id)}
                    className="flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border border-border",
                        on && "bg-foreground text-background",
                      )}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{d.title}</span>
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
