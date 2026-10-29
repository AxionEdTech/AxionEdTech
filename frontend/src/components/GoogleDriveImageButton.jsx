import React, { useState } from "react";
import { driveImageUrl } from "../driveImage.js";

// Replaces file upload entirely — no storage used on our side. An admin
// pastes a Google Drive share link, this converts it into a URL that
// actually renders as a picture, and hands it to onInsert. The Drive file
// itself must be shared as "Anyone with the link can view".
export default function GoogleDriveImageButton({ onInsert, label = "Add image from Drive" }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    setLink("");
    setError("");
  }

  // This sits inside the admin forms, so it must not be a <form> itself:
  // nested forms are invalid HTML and the outer form (Save note, Add
  // question…) could get submitted by the "Insert" click.
  function handleInsert() {
    const url = driveImageUrl(link);
    if (!url) {
      setError('That doesn\'t look like a Google Drive file link — copy it from Drive\'s "Share" dialog.');
      return;
    }
    onInsert(url);
    close();
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        🖼 {label}
      </button>
    );
  }

  return (
    <div className="drive-image-form">
      <input
        autoFocus
        type="url"
        placeholder="Paste Google Drive share link…"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); handleInsert(); }
          if (e.key === "Escape") close();
        }}
      />
      <button type="button" className="btn btn-primary btn-sm" onClick={handleInsert}>Insert</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
      {error && <span className="image-upload-error">{error}</span>}
    </div>
  );
}
