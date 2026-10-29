// Helpers for authoring tables. Markdown tables are easy to get subtly wrong
// by hand (one missing pipe or separator row and the whole thing shows as
// plain text), so the admin forms build them from a grid or from cells pasted
// out of Excel / Google Sheets / Word, and these functions do the conversion.

// Makes one cell safe to put between pipes:
//  - a line break becomes <br> (rendered as a real break)
//  - a "|" in ordinary text becomes \|
//  - a "|" inside $math$ becomes \vert, because \| would mean a double bar in
//    LaTeX (so |ψ⟩ written as $|\psi\rangle$ keeps its single bar)
export function escapeCell(value) {
  const s = String(value ?? "").replace(/\r?\n/g, "<br>").trim();
  return s.replace(/(\$[^$]*\$)|\|/g, (m, math) => (math ? math.replace(/\|/g, "\\vert ") : "\\|"));
}

// rows: string[][] — the first row is the header. Returns a GFM table, columns
// padded so the source stays readable in the text box.
export function rowsToMarkdownTable(rows) {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const cells = rows.map((r) => Array.from({ length: cols }, (_, c) => escapeCell(r[c])));
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.min(40, Math.max(3, ...cells.map((r) => r[c].length)))
  );
  const line = (r) => `| ${r.map((cell, c) => cell.padEnd(widths[c])).join(" | ")} |`;
  const sep = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;
  return [line(cells[0]), sep, ...cells.slice(1).map(line)].join("\n");
}

// Parses tab-separated text the way spreadsheets copy it, including quoted
// cells that contain tabs or line breaks.
export function parseTSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// If pasted text really is a grid (2+ rows, 2+ columns, same column count on
// every row) returns it as a markdown table; otherwise null, so ordinary
// pastes — including text that merely contains a tab — are left alone.
export function tsvToRows(text) {
  if (!text || !text.includes("\t")) return null;
  const rows = parseTSV(text);
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  if (rows.length < 2) return null;
  const cols = rows[0].length;
  if (cols < 2 || !rows.every((r) => r.length === cols)) return null;
  // Tab-indented text (e.g. code) has an empty first cell on every line.
  if (rows.every((r) => r[0].trim() === "")) return null;
  return rows;
}

export function tsvToMarkdownTable(text) {
  const rows = tsvToRows(text);
  return rows ? rowsToMarkdownTable(rows) : null;
}

// For editing JSON by hand: turns a snippet into the text that belongs
// *inside* a JSON string (newlines become \n, quotes become \").
export function jsonEscape(snippet) {
  return JSON.stringify(snippet).slice(1, -1);
}
