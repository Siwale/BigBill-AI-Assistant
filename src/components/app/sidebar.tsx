"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Brain,
  CheckSquare,
  FileText,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
} from "lucide-react";

type Props = {
  assistantName: string;
  userName: string;
  userEmail: string;
  workspaceName: string;
  workspaceSlug: string;
  openTasks: number;
  openIncidents: number;
};

const NAV: Array<{
  href: string;
  label: string;
  icon: typeof MessageSquare;
  exact?: boolean;
  countKey?: "tasks" | "incidents";
}> = [
  { href: "/app", label: "Assistant", icon: MessageSquare, exact: true },
  { href: "/app/tasks", label: "Tasks", icon: CheckSquare, countKey: "tasks" },
  { href: "/app/drafts", label: "Drafts", icon: FileText },
  { href: "/app/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/app/memory", label: "Memory", icon: Brain },
  { href: "/app/permissions", label: "Permissions", icon: ShieldCheck },
  { href: "/app/incidents", label: "Incidents", icon: AlertTriangle, countKey: "incidents" },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  assistantName,
  userName,
  userEmail,
  workspaceName,
  workspaceSlug,
  openTasks,
  openIncidents,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-avatar" aria-hidden>
          {assistantName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="sidebar-name">{assistantName}</div>
          <div className="sidebar-role">Executive Assistant</div>
        </div>
      </div>
      <div className="sidebar-workspace" title={workspaceName}>
        {workspaceName} · {workspaceSlug}
      </div>
      <nav aria-label="Workspace">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const count =
            item.countKey === "tasks" ? openTasks : item.countKey === "incidents" ? openIncidents : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <item.icon size={16} />
              {item.label}
              {count > 0 ? <span className="nav-count">{count}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="sidebar-user" title={userEmail}>
          {userName}
          <br />
          {userEmail}
        </div>
        <button className="sidebar-signout" type="button" onClick={signOut} disabled={signingOut}>
          <LogOut size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
