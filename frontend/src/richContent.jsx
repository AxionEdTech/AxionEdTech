import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Turns a bare image link (not already inside markdown ![]() or []() syntax)
// into a real markdown image, so admins can just paste a plain link and get
// a visible picture instead of raw text.
function autoImageify(text) {
  return text.replace(
    /(?<!\()(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?)/gi,
    "![]($1)"
  );
}

function ContentImage({ src, alt }) {
  return (
    <img
      src={src}
      alt={alt || "diagram"}
      className="content-image"
      loading="lazy"
      draggable={false}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
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

const MARKDOWN_PLUGINS = { remarkPlugins: [remarkMath, remarkGfm], rehypePlugins: [rehypeKatex] };

// Full block of content (a note body, a long explanation): headers, bold,
// italics, lists, math, images, and YouTube links all render properly.
export default function RichContent({ text, className }) {
  if (!text) return null;
  return (
    <div className={className}>
      <ReactMarkdown {...MARKDOWN_PLUGINS} components={{ img: ContentImage, a: LinkOrEmbed }}>
        {autoImageify(text)}
      </ReactMarkdown>
    </div>
  );
}

// Inline variant for short strings (question stems, answer options) that sit
// inside existing markup - still supports bold/italics/math/images/video, but
// without adding its own paragraph wrapper.
export function renderRich(text, keyPrefix) {
  if (!text) return null;
  return (
    <ReactMarkdown key={keyPrefix} {...MARKDOWN_PLUGINS} components={{ p: Inline, img: ContentImage, a: LinkOrEmbed }}>
      {autoImageify(text)}
    </ReactMarkdown>
  );
}
