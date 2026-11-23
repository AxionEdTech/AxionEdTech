import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { drivePreviewUrl, driveViewUrl } from "../lib/drivePdf.js";

// Opens a Drive-hosted PDF inside the page. The question paper and (when
// there is one) the answer key switch in place — no trip to drive.google.com.
export default function PaperView() {
  const { id } = useParams();
  const [paper, setPaper] = useState(undefined);
  const [error, setError] = useState("");
  const [which, setWhich] = useState("paper");

  useEffect(() => {
    setPaper(undefined); setWhich("paper");
    api.getPaper(id).then((d) => setPaper(d.paper)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (paper === undefined) return <div className="page-loading">Loading paper…</div>;
  if (paper === null) {
    return <div className="page"><Link to="/papers" className="back-link">← All papers</Link><p className="empty-state">This paper could not be found.</p></div>;
  }

  const url = which === "key" ? paper.key_url : paper.paper_url;
  const embed = drivePreviewUrl(url);
  const fallback = driveViewUrl(url);
  const heading = `${paper.exam} ${paper.year}${paper.session ? ` · ${paper.session}` : ""}`;

  return (
    <div className="page page-wide">
      <Link to={`/papers?exam=${encodeURIComponent(paper.exam)}`} className="back-link">← {paper.exam} papers</Link>
      <div className="viewer-head">
        <div>
          <h1>{heading}</h1>
          <p className="card-meta">{paper.title || paper.subject}</p>
        </div>
        {paper.key_url && (
          <div className="exam-tabs">
            <button className={which === "paper" ? "active" : ""} onClick={() => setWhich("paper")}>Question paper</button>
            <button className={which === "key" ? "active" : ""} onClick={() => setWhich("key")}>Answer key</button>
          </div>
        )}
      </div>

      {embed ? (
        <div className="pdf-frame">
          <iframe key={embed} src={embed} title={`${heading} ${which === "key" ? "answer key" : "question paper"}`} loading="lazy" allow="autoplay" />
        </div>
      ) : (
        <div className="form-error">This paper's link is not a valid Google Drive link. Please report it from the Contact page.</div>
      )}
      {fallback && <p className="field-hint">Document not showing? <a href={fallback} target="_blank" rel="noopener noreferrer">Open it in a new tab</a>.</p>}
    </div>
  );
}
