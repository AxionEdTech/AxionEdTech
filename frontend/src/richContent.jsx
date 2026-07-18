import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Recognizes, in this priority order:
//   ![alt text](https://image-url)   - markdown-style image, with a caption
//   https://.../picture.png          - a bare image link, auto-rendered even without markdown
//   $$ ... $$                        - block (centered, larger) math
//   $ ... $                          - inline math
const TOKEN_RE =
  /!\[([^\]]*)\]\(([^)\s]+)\)|(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?)|\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/gi;

function renderMath(expr, displayMode, key) {
  try {
    const html = katex.renderToString(expr.trim(), { throwOnError: false, displayMode });
    return (
      <span
        key={key}
        className={displayMode ? "katex-block" : "katex-inline"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <span key={key}>{expr}</span>;
  }
}

// Returns an array of React nodes for one line of text - use inside a <p> or <li> etc.
export function renderRich(text, keyPrefix = "r") {
  if (!text) return null;
  const nodes = [];
  let lastIndex = 0;
  let idx = 0;
  const re = new RegExp(TOKEN_RE.source, "gi");
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [full, imgAlt, imgUrl, bareImgUrl, blockMath, inlineMath] = match;
    const key = `${keyPrefix}-${idx++}`;
    if (imgUrl) {
      nodes.push(<img key={key} src={imgUrl} alt={imgAlt || ""} className="content-image" loading="lazy" draggable={false} />);
    } else if (bareImgUrl) {
      nodes.push(<img key={key} src={bareImgUrl} alt="" className="content-image" loading="lazy" draggable={false} />);
    } else if (blockMath !== undefined) {
      nodes.push(renderMath(blockMath, true, key));
    } else if (inlineMath !== undefined) {
      nodes.push(renderMath(inlineMath, false, key));
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Full block of text (like a note): one paragraph per line, blank lines become spacing.
export default function RichContent({ text, className }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) =>
        line.trim() === "" ? <br key={i} /> : <p key={i}>{renderRich(line, `p${i}`)}</p>
      )}
    </div>
  );
}
