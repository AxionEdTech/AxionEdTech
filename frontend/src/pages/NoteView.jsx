import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import RichContent from "../richContent.jsx";

export default function NoteView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    api.getNote(id).then(setData).catch((e) => setError(e.message));
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

  const { note, watermark } = data;

  return (
    <div className="page">
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
