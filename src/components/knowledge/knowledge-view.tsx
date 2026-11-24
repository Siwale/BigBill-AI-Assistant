"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Search, Trash2, Upload } from "lucide-react";

type DocumentView = {
  id: string;
  title: string;
  mimeType: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

type Hit = {
  chunkId: string;
  documentId: string;
  title: string;
  chunkIndex: number;
  content: string;
  score: number;
};

export function KnowledgeView({ initialDocuments }: { initialDocuments: DocumentView[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!file) {
      setError("Choose a .txt or .md file.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("file", file);
      const response = await fetch("/api/knowledge", { method: "POST", body: form });
      const data = (await response.json()) as { document?: DocumentView; error?: { message?: string } };
      if (!response.ok || !data.document) {
        setError(data.error?.message ?? "Could not index the document.");
        return;
      }
      setDocuments((current) => [data.document!, ...current]);
      setTitle("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Document indexed. Ask the assistant about it, or search below.");
      router.refresh();
    } catch {
      setError("Could not index the document.");
    } finally {
      setBusy(false);
    }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSearching(true);
    try {
      const response = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await response.json()) as { hits?: Hit[]; error?: { message?: string } };
      if (!response.ok) {
        setError(data.error?.message ?? "Search failed.");
        return;
      }
      setHits(data.hits ?? []);
    } catch {
      setError("Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function remove(document: DocumentView) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/knowledge?id=${document.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not remove the document.");
        return;
      }
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setMessage("Document removed from this workspace.");
      router.refresh();
    } catch {
      setError("Could not remove the document.");
    }
  }

  return (
    <div className="stack">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="banner info" role="status">{message}</div> : null}

      <div className="grid-2">
        <form className="card stack" onSubmit={upload}>
          <div>
            <h2 className="section-title">Add a document</h2>
            <p className="section-sub">Plain text or Markdown, up to 1.5 MB. It is chunked and indexed for this tenant only.</p>
          </div>
          <div className="field">
            <label htmlFor="knowledge-title">Title (optional)</label>
            <input
              id="knowledge-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Defaults to the file name"
              maxLength={200}
            />
          </div>
          <div className="field">
            <label htmlFor="knowledge-file">File</label>
            <input
              id="knowledge-file"
              ref={fileRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              <Upload size={15} /> {busy ? "Indexing…" : "Index document"}
            </button>
          </div>
        </form>

        <form className="card stack" onSubmit={search}>
          <div>
            <h2 className="section-title">Test retrieval</h2>
            <p className="section-sub">
              Runs the same tenant-filtered hybrid search the assistant uses, and shows the exact passages.
            </p>
          </div>
          <div className="field">
            <label htmlFor="knowledge-query">Query</label>
            <input
              id="knowledge-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. supplier payment terms"
              minLength={2}
              required
            />
          </div>
          <div>
            <button className="btn" type="submit" disabled={searching}>
              <Search size={15} /> {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {hits ? (
            hits.length === 0 ? (
              <div className="empty">No passages matched. Try different words, or add a document.</div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {hits.map((hit) => (
                  <div className="draft-card" key={hit.chunkId}>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <BookOpen size={14} />
                      <strong>{hit.title}</strong>
                      <span className="badge badge-muted">chunk {hit.chunkIndex + 1}</span>
                    </div>
                    <p className="tiny muted" style={{ marginTop: 6 }}>
                      {hit.content.slice(0, 500)}
                      {hit.content.length > 500 ? "…" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </form>
      </div>

      <section>
        <h2 className="section-title">Indexed documents</h2>
        <p className="section-sub">{documents.length} in this workspace.</p>
        {documents.length === 0 ? (
          <div className="empty">No documents yet. Upload a text or Markdown file above.</div>
        ) : (
          <div className="list">
            {documents.map((document) => (
              <div className="list-item" key={document.id}>
                <div className="list-item-main">
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <BookOpen size={14} />
                    <span className="list-item-title">{document.title}</span>
                    <span className="badge badge-green">{document.status}</span>
                    <span className="badge badge-muted">{document.mimeType}</span>
                  </div>
                  <div className="list-item-meta">
                    Indexed{" "}
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
                      new Date(document.createdAt),
                    )}
                  </div>
                  {document.errorMessage ? (
                    <div className="list-item-meta" style={{ color: "var(--warn)" }}>
                      {document.errorMessage}
                    </div>
                  ) : null}
                </div>
                <div className="list-item-actions">
                  <button className="btn btn-sm btn-danger" type="button" onClick={() => void remove(document)}>
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
