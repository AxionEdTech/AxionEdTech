import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { normalizeImageSrc, driveFallbackUrl } from "./driveImage.js";
import { prepareRichText, remarkInlineBr } from "./richText.js";

// A picture from a pasted link (usually Google Drive). While it loads it
// holds its place in a framed box, so the text around it doesn't jump when it
// arrives; if the first URL form is refused it quietly tries Drive's second
// form; and if both fail it says so, instead of vanishing without a trace.
function ContentImage({ src, alt }) {
  const [stage, setStage] = useState(0); // 0 = main URL, 1 = fallback URL, 2 = gave up
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setStage(0); setLoaded(false); }, [src]);

  const fallback = driveFallbackUrl(src);
  const current = stage === 0 ? normalizeImageSrc(src) : fallback;

  if (stage >= 2 || !current) {
    return (
      <span className="content-image-fallback" role="img" aria-label="Image could not be loaded">
        Image couldn't be loaded. If this is a Drive link, check that the file is shared as "Anyone with the link can view".
      </span>
    );
  }

  return (
    <span className={`content-image-frame${loaded ? " is-loaded" : ""}`}>
      <img
        src={current}
        alt={alt || "Figure"}
        className="content-image"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setStage((s) => (s === 0 && fallback ? 1 : 2))}
      />
    </span>
  );
}

// Tables scroll sideways inside their own box instead of stretching (or being
// clipped by) the page. A soft shadow on the left/right edge shows when more
// columns are hidden that way, so a student never misses one; the box is
// keyboard-focusable so it can be scrolled without a mouse.
function RichTable({ children }) {
  const scrollRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className={`table-shell${edges.left ? " can-scroll-left" : ""}${edges.right ? " can-scroll-right" : ""}`}>
      <div className="table-wrap" ref={scrollRef} onScroll={measure} role="region" aria-label="Table" tabIndex={0}>
        <table>{children}</table>
      </div>
    </div>
  );
}

// Recognizes a real YouTube URL (watch?v=, youtu.be/, or /embed/ form) and
// pulls out the video ID, whether it arrived as a bare pasted link (which
// remark-gfm auto-links for us) or an explicit [text](url) markdown link.
function extractYoutubeId(href) {
  if (!href) return null;
  const m = href.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,15})/i);
  return m ? m[1] : null;
}

// Renders a normal link, unless it points at YouTube, in which case it
// renders a real playable embedded player instead.
function LinkOrEmbed({ href, children }) {
  const videoId = extractYoutubeId(href);
  if (videoId) {
    return (
      <span className="video-embed">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </span>
    );
  }
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

// Renders children without the block-level wrapper element Markdown would
// normally add - used for inline contexts (a PYQ option, a single question
// line) where the surrounding JSX already provides a <p>/<li>/<span>.
function Inline({ children }) {
  return <>{children}</>;
}

const MARKDOWN_PLUGINS = {
  remarkPlugins: [remarkMath, remarkGfm, remarkInlineBr],
  rehypePlugins: [rehypeKatex],
};
const BASE_COMPONENTS = { img: ContentImage, a: LinkOrEmbed, table: RichTable };
const INLINE_COMPONENTS = { ...BASE_COMPONENTS, p: Inline };

// Full block of content (a note body, a long explanation): headers, bold,
// italics, lists, tables, math, images, and YouTube links all render properly.
export default function RichContent({ text, className }) {
  if (!text) return null;
  return (
    <div className={className}>
      <ReactMarkdown {...MARKDOWN_PLUGINS} components={BASE_COMPONENTS}>
        {prepareRichText(text)}
      </ReactMarkdown>
    </div>
  );
}

// Rich text for short strings that sit inside existing markup.
//  - default (inline): an answer option or a single line - no paragraph
//    wrapper of its own, so it flows inside the surrounding <span>/<li>.
//  - { block: true }: a question stem - keeps paragraphs, tables and images
//    as proper blocks (use it inside a <div>, never a <p>).
export function renderRich(text, keyPrefix, { block = false } = {}) {
  if (!text) return null;
  if (block) {
    return (
      <div key={keyPrefix} className="rich-block">
        <ReactMarkdown {...MARKDOWN_PLUGINS} components={BASE_COMPONENTS}>
          {prepareRichText(text)}
        </ReactMarkdown>
      </div>
    );
  }
  return (
    <ReactMarkdown key={keyPrefix} {...MARKDOWN_PLUGINS} components={INLINE_COMPONENTS}>
      {prepareRichText(text)}
    </ReactMarkdown>
  );
}
