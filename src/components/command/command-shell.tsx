"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Bell,
  Box,
  Camera,
  Cpu,
  Headphones,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Search,
  Settings,
  Sparkles,
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

const TOP_NAV = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/engineering", label: "Engineer" },
  { href: "/app/repositories", label: "Repositories" },
  { href: "/app/forge", label: "Forge" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/devices", label: "Devices" },
  { href: "/app/media", label: "Media" },
  { href: "/app/vision", label: "Vision" },
];

const RAIL = [
  { href: "/app", label: "Command", icon: MessageSquare, exact: true },
  { href: "/app/engineering", label: "Engineering", icon: Cpu },
  { href: "/app/repositories", label: "Repositories", icon: Box },
  { href: "/app/projects", label: "Projects", icon: Layers },
  { href: "/app/meetings", label: "Meetings", icon: Users },
  { href: "/app/devices", label: "Devices", icon: Search },
  { href: "/app/media", label: "Media", icon: Headphones },
  { href: "/app/vision", label: "Vision", icon: Camera },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function CommandShell({ assistantName, userName, userEmail: _userEmail, workspaceName, children, companionStatus }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [voiceState] = useState<"idle" | "listening">("idle");

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="command-env" style={{ minHeight: "100vh", background: "var(--cmd-bg)", color: "var(--cmd-ink)", display: "flex", flexDirection: "column" }}>
      {/* Top command bar */}
      <header
        style={{
          height: 56,
          background: "rgba(2,8,18,0.9)",
          borderBottom: "1px solid var(--cmd-line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #00e5ff, #5eb0ff)", borderRadius: 8, display: "grid", placeItems: "center", color: "#020812", fontWeight: 800 }}>A</div>
            <div>
              <div style={{ fontWeight: 800, letterSpacing: 1, fontSize: 16 }}>{assistantName.slice(0, 4).toUpperCase()}</div>
              <div style={{ fontSize: 9, color: "var(--cmd-muted)", letterSpacing: 1, marginTop: -4 }}>AI Executive Assistant</div>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 4 }} className="hide-mobile">
            {TOP_NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    color: active ? "var(--cmd-cyan)" : "var(--cmd-ink-soft)",
                    background: active ? "rgba(0,229,255,0.12)" : "transparent",
                    border: active ? "1px solid var(--cmd-line-strong)" : "1px solid transparent",
                    boxShadow: active ? "0 0 10px rgba(0,229,255,0.2)" : "none",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--cmd-muted)", background: "rgba(0,229,255,0.1)", padding: "4px 8px", borderRadius: 20, border: "1px solid var(--cmd-line)" }}>Loop 4 · Engineering Intelligence</span>
          <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, color: companionStatus === "available" ? "var(--cmd-green)" : "var(--cmd-muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: companionStatus === "available" ? "var(--cmd-green)" : "var(--cmd-muted)", boxShadow: companionStatus === "available" ? "0 0 8px var(--cmd-green)" : "none" }} /> {workspaceName}
          </span>
          <Bell size={16} style={{ color: "var(--cmd-muted)" }} />
          <Settings size={16} style={{ color: "var(--cmd-muted)" }} />
          <div style={{ width: 28, height: 28, borderRadius: 999, background: "var(--cmd-surface-strong)", display: "grid", placeItems: "center", fontSize: 12, border: "1px solid var(--cmd-line)" }}>{userName.slice(0, 1).toUpperCase()}</div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="show-mobile" style={{ background: "transparent", border: "none", color: "var(--cmd-ink)" }}>
            <Menu size={18} />
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left vertical command rail */}
        <aside
          style={{
            width: 220,
            background: "rgba(2,8,18,0.8)",
            borderRight: "1px solid var(--cmd-line)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
          className="hide-mobile"
        >
          {RAIL.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  color: active ? "var(--cmd-cyan)" : "var(--cmd-ink-soft)",
                  background: active ? "rgba(0,229,255,0.1)" : "transparent",
                  borderLeft: active ? "3px solid var(--cmd-cyan)" : "3px solid transparent",
                  boxShadow: active ? "0 0 12px rgba(0,229,255,0.15)" : "none",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--cmd-line)", fontSize: 11, color: "var(--cmd-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--cmd-green)" }} /> Aida Online
            </div>
            <div style={{ marginTop: 4 }}>v4.0 (Loop 4)</div>
            <div>Forge • Local Repos</div>
            <button onClick={signOut} style={{ marginTop: 8, background: "transparent", border: "1px solid var(--cmd-line)", color: "var(--cmd-ink-soft)", padding: "6px 10px", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </aside>

        {/* Main stage */}
        <main style={{ flex: 1, padding: 20, background: "radial-gradient(1200px 600px at 50% -10%, rgba(0,229,255,0.08), transparent), var(--cmd-bg)", overflow: "auto" }}>
          {children}
        </main>
      </div>

      {/* Persistent command/voice dock */}
      <footer
        style={{
          height: 72,
          background: "rgba(2,8,18,0.95)",
          borderTop: "1px solid var(--cmd-line)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          position: "sticky",
          bottom: 0,
        }}
      >
        <button
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: voiceState === "listening" ? "var(--cmd-red)" : "rgba(0,229,255,0.15)",
            border: `1px solid ${voiceState === "listening" ? "var(--cmd-red)" : "var(--cmd-line-strong)"}`,
            display: "grid",
            placeItems: "center",
            color: "var(--cmd-cyan)",
          }}
          aria-label="Voice input"
        >
          {voiceState === "listening" ? <Square size={16} /> : <Mic size={16} />}
        </button>
        <div style={{ flex: 1, background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 999, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <input placeholder="Ask Aida anything..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--cmd-ink)", fontSize: 14 }} />
          <Sparkles size={16} style={{ color: "var(--cmd-muted)" }} />
        </div>
        <Activity size={18} style={{ color: "var(--cmd-muted)" }} />
      </footer>

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
