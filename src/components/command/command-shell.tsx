"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Camera,
  Cpu,
  Headphones,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  MonitorSmartphone,
  Search,
  Settings,
  Square,
  Users,
} from "lucide-react";

type Props = {
  assistantName: string;
  userName: string;
  userEmail: string;
  workspaceName: string;
  children: React.ReactNode;
  companionStatus?: string;
};

/* Reference top bar: workspace-level destinations (no History/Command duplication). */
const TOP_NAV = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/engineering", label: "Engineer" },
  { href: "/app/repositories", label: "Repositories" },
  { href: "/app/forge", label: "Forge" },
  { href: "/app/qylon", label: "Qylon" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/devices", label: "Devices" },
  { href: "/app/media", label: "Media" },
  { href: "/app/vision", label: "Vision" },
];

/* Reference left rail: command work areas. History lives in the conversation drawer. */
const RAIL = [
  { href: "/app", label: "Command", icon: MessageSquare, exact: true },
  { href: "/app/engineering", label: "Engineering", icon: Cpu },
  { href: "/app/projects", label: "Projects", icon: Layers },
  { href: "/app/meetings", label: "Meetings", icon: Users },
  { href: "/app/devices", label: "Devices", icon: MonitorSmartphone },
  { href: "/app/media", label: "Media", icon: Headphones },
  { href: "/app/vision", label: "Vision", icon: Camera },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

const RAIL_DISABLED = [{ label: "Automation", reason: "Not connected — no automation provider configured" }];

function AidaMark() {
  return (
    <svg width="46" height="42" viewBox="0 0 46 42" aria-hidden role="img">
      <defs>
        <linearGradient id="aida-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5AD5FB" />
          <stop offset="0.55" stopColor="#31BAF2" />
          <stop offset="1" stopColor="#1D75B5" />
        </linearGradient>
      </defs>
      <path
        d="M23 3 L43 37 L33.5 37 L23 16.5 L12.5 37 L3 37 Z"
        fill="url(#aida-mark)"
        opacity="0.92"
      />
      <path d="M17 29.5 L29 29.5" stroke="#E8F6FF" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M23 3 L43 37 L33.5 37 L23 16.5 L12.5 37 L3 37 Z"
        fill="none"
        stroke="#5AD5FB"
        strokeWidth="1"
        opacity="0.7"
      />
    </svg>
  );
}

export function CommandShell({ assistantName, userName, workspaceName, children, companionStatus }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [voiceState] = useState<"idle" | "listening">("idle");
  // Command/Home owns the full conversation composer; the persistent shell
  // composer serves every other route and hands off into the same conversation.
  const isCommandHome = pathname === "/app";

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="aida-cc">
      <header className="aida-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div className="aida-brand">
            <AidaMark />
            <div>
              <div className="aida-brand-name">{assistantName.slice(0, 4).toUpperCase()}</div>
              <div className="aida-brand-sub">AI Executive Assistant</div>
            </div>
          </div>
          <nav className="aida-nav hide-mobile" aria-label="Workspace">
            {TOP_NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="aida-loop-badge">Loop 4 — Engineering Intelligence</span>
          <Bell size={16} style={{ color: "var(--aida-text-muted)" }} aria-label="Notifications" />
          <Link href="/app/settings" aria-label="Settings" style={{ color: "var(--aida-text-muted)", display: "grid", placeItems: "center" }}>
            <Settings size={16} />
          </Link>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: "var(--aida-surface-2)", display: "grid", placeItems: "center", fontSize: 12, border: "1px solid var(--aida-border)", color: "var(--aida-text)" }}>
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="show-mobile" style={{ background: "transparent", border: "none", color: "var(--aida-text)" }} aria-label="Menu">
            <Menu size={18} />
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside className="aida-rail hide-mobile" aria-label="Command areas">
          {RAIL.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
          {RAIL_DISABLED.map((item) => (
            <span
              key={item.label}
              title={item.reason}
              aria-disabled="true"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                color: "var(--aida-text-dim)",
                fontSize: 13,
                borderLeft: "3px solid transparent",
                cursor: "not-allowed",
              }}
            >
              <Settings size={16} />
              {item.label}
            </span>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--aida-border)", fontSize: 11, color: "var(--aida-text-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--aida-success)" }} /> Aida Online
            </div>
            <div style={{ marginTop: 4 }}>v4.0 (Loop 4)</div>
            <div>Forge • Local Repos • Qylon</div>
            <div style={{ marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={workspaceName}>{workspaceName}</div>
            <div style={{ marginTop: 4, fontSize: 10 }}>Companion: {companionStatus ?? "checking"}</div>
            <button onClick={signOut} style={{ marginTop: 8, background: "transparent", border: "1px solid var(--aida-border)", color: "var(--aida-text)", padding: "6px 10px", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </aside>
        {mobileOpen ? (
          <nav aria-label="Command areas mobile" style={{ position: "absolute", top: 64, left: 8, zIndex: 60, background: "rgba(3,20,35,0.97)", border: "1px solid var(--aida-border)", borderRadius: 12, padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
            {RAIL.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{ padding: "8px 12px", color: "var(--aida-text)", fontSize: 13 }}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <main style={{ flex: 1, padding: 20, minWidth: 0, overflow: "auto" }}>{children}</main>
      </div>

      {isCommandHome ? null : (
      <footer style={{ padding: "12px 20px 18px", background: "transparent" }}>
        <form
          className="aida-composer"
          role="search"
          aria-label="Ask Aida"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const text = String(data.get("q") ?? "").trim();
            if (!text) return;
            e.currentTarget.reset();
            if (isCommandHome) {
              window.dispatchEvent(new CustomEvent("aida:ask", { detail: { text } }));
            } else {
              // No conversation surface on this route — hand into Command's
              // continuous conversation; it auto-sends once and cleans the URL.
              router.push(`/app?ask=${encodeURIComponent(text)}`);
            }
          }}
        >
          <button
            type="button"
            className="aida-mic"
            aria-label="Voice input (explicit action)"
            onClick={() => {
              if (isCommandHome) {
                window.dispatchEvent(new CustomEvent("aida:mic"));
              } else {
                router.push("/app?mic=1");
              }
            }}
          >
            {voiceState === "listening" ? <Square size={16} /> : <Mic size={16} />}
          </button>
          <input name="q" placeholder="Ask Aida anything…" aria-label="Ask Aida anything" autoComplete="off" />
          <span className="aida-meta" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Search size={14} />
          </span>
        </form>
      </footer>
      )}

      <style>{`
        @media (max-width: 900px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: grid !important; }
        }
        @media (min-width: 901px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
