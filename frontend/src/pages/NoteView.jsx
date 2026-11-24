import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import RichContent from "../components/RichContent.jsx";
import UpgradeNotice from "../components/UpgradeNotice.jsx";
import { pushRecent, removeRecent } from "../lib/recent.js";

export default function NoteView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    api.getNote(id)
      .then(async (d) => {
        if (d.restricted) {
          d.meta = await api.noteMeta(id).catch(() => undefined);
          if (d.meta === null) removeRecent(id); // the note no longer exists
        } else {
          pushRecent(d.note);
        }
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    // Deterrents only — a determined person can always screenshot. These just
    // remove the easy paths (right-click save, drag-select copy, print/save shortcuts).
    const blockContextMenu = (e) => e.preventDefault();
    const blockCopy = (e) => e.preventDefault();
    const blockKeys = (e) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["p", "s", "c", "u"].includes(k)) e.preventDefault();
    };
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("copy", blockCopy);
    document.addEventListener("keydown", blockKeys);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("keydown", blockKeys);
    };
  }, []);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!data) return <div className="page-loading">Loading note…</div>;

  if (data.restricted) {
    const minPlan = data.meta?.min_plan || "notes_mock";
    return (
      <div className="page">
        <Link to="/notes" className="back-link">← Back to notes</Link>
        <UpgradeNotice
          minPlan={minPlan} what="note"
          title={minPlan === "free" ? "Create a free account to read this note" : undefined}
        />
        {data.meta && <p className="card-meta" style={{ textAlign: "center" }}>{data.meta.title} · {data.meta.exam} · {data.meta.subject}</p>}
      </div>
    );
  }

  const { note, watermark } = data;

  return (
    <div className="page page-reading">
      <Link to="/notes" className="back-link">← Back to notes</Link>
      <div className="note-reader">
        <div className="note-reader-watermark" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => <span key={i}>{watermark}</span>)}
        </div>
        <p className="eyebrow">{note.subject} · {note.unit}</p>
        <h1>{note.title}</h1>
        <div className="note-content" onDragStart={(e) => e.preventDefault()}>
          <RichContent text={note.content} />
        </div>
        <p className="note-footer-note">Personal use only — not for redistribution. Viewed by {watermark}.</p>
      </div>
    </div>
  );
}
