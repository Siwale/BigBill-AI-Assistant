"use client";

import { useState } from "react";
import { Check, Copy, FileText } from "lucide-react";

type DraftView = {
  id: string;
  kind: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

export function DraftsView({ drafts }: { drafts: DraftView[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(draft: DraftView) {
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(draft.id);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  if (drafts.length === 0) {
    return (
      <div className="empty">
        No drafts yet. Ask your assistant to prepare an email, WhatsApp message, marketing plan or Khapy
        creative brief, and it will appear here for review.
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="banner info">
        Drafts are local only. Sending email or WhatsApp, publishing social content and transferring a brief
        to Khapy are disabled in this release.
      </div>
      {drafts.map((draft) => (
        <details className="draft-card" key={draft.id}>
          <summary>
            <div className="spread">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <FileText size={15} />
                <strong>{draft.title}</strong>
                <span className="badge badge-info">{kindLabel(draft.kind)}</span>
              </div>
              <span className="tiny muted">
                {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(draft.createdAt),
                )}
              </span>
            </div>
          </summary>
          <div className="draft-body">{draft.body}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-sm" type="button" onClick={() => void copy(draft)}>
              {copied === draft.id ? <Check size={13} /> : <Copy size={13} />}
              {copied === draft.id ? "Copied" : "Copy text"}
            </button>
            <span className="tiny muted">Review before using it anywhere else.</span>
          </div>
        </details>
      ))}
    </div>
  );
}
