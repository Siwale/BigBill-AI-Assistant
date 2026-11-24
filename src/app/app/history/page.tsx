import { requireOnboardedPageSession } from "@/modules/auth/session";
import { listArchivedConversations, listMessages } from "@/modules/conversations/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const session = await requireOnboardedPageSession();
  const { q, c } = await searchParams;
  const archived = await listArchivedConversations(session.user.tenantId, session.user.id);
  const filtered = q ? archived.filter((conv) => conv.title.toLowerCase().includes(q.toLowerCase())) : archived;
  let viewed: Awaited<ReturnType<typeof listMessages>> | null = null;
  if (c) {
    try {
      viewed = await listMessages(session.user.tenantId, c);
    } catch {}
  }
  return (
    <div className="command-env" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 18, color: "var(--cmd-cyan)" }}>History — Archived conversations</h1>
      <p style={{ margin: 0, fontSize: 12, color: "var(--cmd-muted)" }}>Archive is not delete. Search by title, open read-only transcript, or ask Aida to retrieve relevant context into the current active conversation.</p>
      <form style={{ display: "flex", gap: 8 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Search archived conversations..." style={{ flex: 1, background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 8, padding: "8px 12px", color: "var(--cmd-ink)" }} />
        <button className="btn btn-sm" type="submit">Search</button>
      </form>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div style={{ background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 12, padding: 12, maxHeight: 500, overflow: "auto" }}>
          {filtered.length === 0 ? <div style={{ fontSize: 12, color: "var(--cmd-muted)" }}>No archived conversations{ q ? ` for "${q}"` : ""}.</div> : filtered.map((conv) => (
            <Link key={conv.id} href={`/app/history?c=${conv.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} style={{ display: "block", padding: "8px 10px", borderRadius: 8, background: c === conv.id ? "rgba(0,229,255,0.1)" : "transparent", color: "var(--cmd-ink-soft)", fontSize: 12, marginBottom: 6, border: c === conv.id ? "1px solid var(--cmd-line-strong)" : "1px solid transparent" }}>
              <div style={{ fontWeight: 600 }}>{conv.title}</div>
              <div style={{ fontSize: 11, color: "var(--cmd-muted)" }}>{conv.updatedAt.toISOString().slice(0, 10)} • {conv.id.slice(0, 8)}</div>
            </Link>
          ))}
        </div>
        <div style={{ background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 12, padding: 16, maxHeight: 500, overflow: "auto" }}>
          {!c ? <div style={{ fontSize: 12, color: "var(--cmd-muted)" }}>Select an archived conversation to view read-only transcript.</div> : !viewed ? <div style={{ fontSize: 12, color: "var(--cmd-muted)" }}>Conversation not found or not accessible.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {viewed.map((m) => (
                <div key={m.id} style={{ background: m.role === "assistant" ? "rgba(0,229,255,0.07)" : "rgba(255,255,255,0.02)", border: "1px solid var(--cmd-line)", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--cmd-muted)" }}>{m.role} • {m.createdAt.toISOString().slice(0, 16)}</div>
                  <div style={{ fontSize: 13, color: "var(--cmd-ink)", whiteSpace: "pre-wrap", marginTop: 4 }}>{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
