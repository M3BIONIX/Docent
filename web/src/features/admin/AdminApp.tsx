import { useState } from "react";
import { Users, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UsersTab } from "./UsersTab";
import { DocumentsTab } from "./DocumentsTab";
import { AnalyticsTab } from "./AnalyticsTab";

type Tab = "users" | "documents" | "analytics";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "users", label: "Users & access", icon: Users },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "analytics", label: "Understanding", icon: BarChart3 },
];

export function AdminApp() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 px-8 py-6">
      <nav className="flex gap-6 border-b border-border">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-1 py-2.5 text-sm transition-colors",
              tab === key
                ? "border-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "users" && <UsersTab />}
        {tab === "documents" && <DocumentsTab />}
        {tab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}
