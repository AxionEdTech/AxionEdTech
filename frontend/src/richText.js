// Pure text helpers behind the rich-content renderer (no React, so they can
// be tested on their own).
import { isImageLikeUrl } from "./driveImage.js";

// Fenced blocks and `inline code` are left alone, so a URL shown *as code*
// stays literal text instead of turning into a picture.
const CODE_SPLIT_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/;

// A bare URL = starts at the beginning of the text, or after whitespace or a
// table-cell pipe. That excludes URLs already inside [text](url), ![](url) or
// <url>, which are written with other characters in front.
const BARE_URL_RE = /(^|[\s|])(https?:\/\/[^\s<>|]+)/g;

function splitTrailingPunctuation(url) {
  let trail = "";
  for (;;) {
    const last = url[url.length - 1];
    const peel = last && (/[.,;:!?'"\]}]/.test(last) || (last === ")" && !url.includes("(")));
    if (!peel) break;
    trail = last + trail;
    url = url.slice(0, -1);
  }
  return [url, trail];
}

// Turns a pasted image link into a real markdown image, right where it sits
// in the text — so an author can paste a Google Drive share link between two
// sentences (or inside a table cell, or as an option) and the picture shows up
// in exactly that spot.
export function autoImageify(text) {
  if (!text) return text;
  return text
    .split(CODE_SPLIT_RE)
    .map((part, i) => {
      if (i % 2 === 1) return part; // code segment
      return part.replace(BARE_URL_RE, (match, lead, rawUrl, offset, whole) => {
        const before = whole.slice(0, offset + lead.length).trimEnd();
        if (before.endsWith("](")) return match; // already a markdown destination
        const [url, trail] = splitTrailingPunctuation(rawUrl);
        if (!isImageLikeUrl(url)) return match;
        return `${lead}![](<${url}>)${trail}`;
      });
    })
    .join("");
}

// Markdown has no line break inside a table cell, so authors write <br>.
// Raw HTML is (deliberately) not rendered, so turn a literal <br> into a real
// break node instead of letting it show up as text.
export function remarkInlineBr() {
  const isBr = (n) => n.type === "html" && /^<br\s*\/?>$/i.test((n.value || "").trim());
  const walk = (node) => {
    if (!node.children) return;
    node.children = node.children.map((child) => {
      if (isBr(child)) return { type: "break" };
      walk(child);
      return child;
    });
  };
  return (tree) => walk(tree);
}

// A GFM table is a header row followed by a delimiter row (| --- | --- |).
const DELIMITER_ROW_RE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const isDelimiterRow = (line) => line.includes("|") && DELIMITER_ROW_RE.test(line);

// Markdown needs a blank line between a table and the text around it:
// without one, the sentence right after a table is swallowed as one more
// table row, and a table right after a sentence isn't recognised. Authors
// (and the text-box parser for mock tests, where a blank line would mean
// "next question") often leave that blank line out, so add it. Only real
// tables are touched — a line like |ψ⟩ = α|0⟩ + β|1⟩ is left alone — and
// fenced code is skipped.
export function separateTables(text) {
  if (!text || !text.includes("|")) return text;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inFence = false;
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; inTable = false; out.push(line); continue; }
    if (inFence) { out.push(line); continue; }
    if (line.trim() === "") { inTable = false; out.push(line); continue; }
    if (inTable) {
      if (!line.includes("|")) { out.push(""); inTable = false; } // text straight after the table
    } else if (line.includes("|") && i + 1 < lines.length && isDelimiterRow(lines[i + 1])) {
      if (out.length && out[out.length - 1].trim() !== "") out.push(""); // table straight after text
      inTable = true;
    }
    out.push(line);
  }
  return out.join("\n");
}

// Everything done to author-written text before it goes to the markdown renderer.
export const prepareRichText = (text) => separateTables(autoImageify(text));
