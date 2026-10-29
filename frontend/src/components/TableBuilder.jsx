import React, { useState } from "react";
import { rowsToMarkdownTable, tsvToRows } from "../tableMarkdown.js";

const MAX_COLS = 8;
const MAX_ROWS = 30;
const blank = (r, c) => Array.from({ length: r }, () => Array(c).fill(""));

// A small grid for making a table without knowing any markdown: fill in the
// cells (first row = column headings), or paste cells copied from Excel /
// Google Sheets / Word straight into the grid. onInsert receives the finished
// markdown table; the caller decides where and how to put it in the text.
// Deliberately NOT a <form> — it lives inside the admin forms.
export default function TableBuilder({ onInsert, onClose }) {
  const [rows, setRows] = useState(() => blank(3, 3));
  const [error, setError] = useState("");
  const nCols = rows[0].length;

  const setCell = (r, c, v) =>
    setRows((rs) => rs.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));

  function resize(dRows, dCols) {
    setRows((rs) => {
      const cols = Math.min(MAX_COLS, Math.max(2, rs[0].length + dCols));
      const count = Math.min(MAX_ROWS, Math.max(2, rs.length + dRows));
      const next = rs.map((r) => (cols > r.length ? [...r, ...Array(cols - r.length).fill("")] : r.slice(0, cols)));
      while (next.length < count) next.push(Array(cols).fill(""));
      return next.slice(0, count);
    });
  }

  function handlePaste(e) {
    const grid = tsvToRows(e.clipboardData.getData("text/plain"));
    if (!grid) return; // an ordinary paste into one cell
    e.preventDefault();
    setRows(grid);
    setError("");
  }

  function handleInsert() {
    if (!rows.some((r) => r.some((c) => c.trim()))) {
      setError("Type something in at least one cell first.");
      return;
    }
    // Leave out body rows that were never filled in, so a default 3-row grid
    // used for two rows of data doesn't end with an empty row.
    const body = rows.slice(1).filter((r) => r.some((c) => c.trim()));
    onInsert(rowsToMarkdownTable([rows[0], ...body]));
    onClose();
  }

  const stepper = (label, value, onMinus, onPlus) => (
    <span className="stepper">
      {label}
      <button type="button" className="stepper-btn" aria-label={`Fewer ${label.toLowerCase()}`} onClick={onMinus}>−</button>
      <strong>{value}</strong>
      <button type="button" className="stepper-btn" aria-label={`More ${label.toLowerCase()}`} onClick={onPlus}>+</button>
    </span>
  );

  return (
    <div className="table-builder" onPaste={handlePaste}>
      <div className="table-builder-bar">
        {stepper("Columns", nCols, () => resize(0, -1), () => resize(0, 1))}
        {stepper("Rows", rows.length, () => resize(-1, 0), () => resize(1, 0))}
        <span className="table-builder-tip">First row is the heading row. You can also paste cells copied from Excel or Google Sheets here.</span>
      </div>
      <div className="table-builder-scroll">
        <div className="table-builder-grid" style={{ "--cols": nCols }}>
          {rows.map((row, r) =>
            row.map((cell, c) => (
              <input
                key={`${r}-${c}`}
                className={r === 0 ? "is-head" : ""}
                aria-label={r === 0 ? `Heading ${c + 1}` : `Row ${r}, column ${c + 1}`}
                placeholder={r === 0 ? `Heading ${c + 1}` : ""}
                value={cell}
                onChange={(e) => setCell(r, c, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              />
            ))
          )}
        </div>
      </div>
      <div className="table-builder-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={handleInsert}>Insert table</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        {error && <span className="image-upload-error">{error}</span>}
      </div>
    </div>
  );
}
