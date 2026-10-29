import React, { useRef, useState } from "react";
import GoogleDriveImageButton from "./GoogleDriveImageButton.jsx";
import TableBuilder from "./TableBuilder.jsx";
import RichContent from "../richContent.jsx";
import { insertAtCursor } from "../textInsert.js";
import { tsvToMarkdownTable } from "../tableMarkdown.js";

// The one editing box used for Notes and PYQs: the text area plus the tools an
// author needs around it — add a Drive image, build a table, and preview
// exactly what students will see. Pasting cells copied from a spreadsheet
// turns into a table automatically.
export default function ContentEditor({ id, label = "Content", value, onChange, rows = 10, required = false, children }) {
  const ref = useRef(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const insert = (snippet) => insertAtCursor(ref, value, onChange, snippet);

  function handlePaste(e) {
    const md = tsvToMarkdownTable(e.clipboardData.getData("text/plain"));
    if (!md) return; // normal paste
    e.preventDefault();
    insert(`\n\n${md}\n\n`);
  }

  return (
    <>
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        <div className="editor-tools">
          <GoogleDriveImageButton onInsert={(url) => insert(`\n![](${url})\n`)} />
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={tableOpen} onClick={() => setTableOpen((v) => !v)}>
            ▦ Insert table
          </button>
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={preview} onClick={() => setPreview((v) => !v)}>
            {preview ? "Hide preview" : "Preview"}
          </button>
        </div>
      </div>
      {tableOpen && <TableBuilder onInsert={(md) => insert(`\n\n${md}\n\n`)} onClose={() => setTableOpen(false)} />}
      <textarea id={id} ref={ref} required={required} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} onPaste={handlePaste} />
      {preview && (
        <div className="content-preview">
          <p className="content-preview-label">Preview — how students will see it</p>
          {value.trim() ? <div className="note-content"><RichContent text={value} /></div> : <p className="field-hint" style={{ margin: 0 }}>Nothing to preview yet.</p>}
        </div>
      )}
      {children}
    </>
  );
}
