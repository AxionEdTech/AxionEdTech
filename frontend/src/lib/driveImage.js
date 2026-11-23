// A Google Drive "share" link (drive.google.com/file/d/ID/view?usp=sharing,
// or drive.google.com/open?id=ID) opens Drive's HTML viewer page, not the
// image itself — so it can't be used directly as an <img src>. This pulls
// the file ID out of any of Drive's link shapes and rebuilds a URL that
// actually renders as a picture when hotlinked, as long as the file's
// sharing is set to "Anyone with the link can view".
const DRIVE_LINK_RE = /(?:drive|docs)\.google\.com|drive\.usercontent\.google\.com/i;

export function extractDriveFileId(url) {
  if (!url) return null;
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

export function driveImageUrl(shareLink) {
  const id = extractDriveFileId((shareLink || "").trim());
  return id ? `https://lh3.googleusercontent.com/d/${id}=w1000` : null;
}

// Second-chance URL for the same file, used if the first one fails to load
// (Drive occasionally refuses one hotlink form but serves the other).
export function driveFallbackUrl(src) {
  if (!src) return null;
  let id = null;
  if (DRIVE_LINK_RE.test(src)) id = extractDriveFileId(src);
  else {
    const m = src.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/); // link the "Add image" button inserted
    if (m) id = m[1];
  }
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : null;
}

// Rewrites a Drive share link to the hotlinkable form wherever one shows up
// as an <img src> — used both for note/PYQ/question content and for the
// author photo in the site footer, so there's one place this logic lives.
export function normalizeImageSrc(src) {
  if (!src || !DRIVE_LINK_RE.test(src)) return src;
  const id = extractDriveFileId(src);
  return id ? `https://lh3.googleusercontent.com/d/${id}=w1000` : src;
}

// True for a URL that should be shown as a picture when it's pasted bare into
// text: a Drive file link, a direct googleusercontent link, or any link whose
// path ends in an image extension. Everything else (ordinary web pages,
// YouTube, Drive folders / Docs / Sheets) stays a normal link.
export function isImageLikeUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname.toLowerCase();
  if (DRIVE_LINK_RE.test(host)) return !!extractDriveFileId(url);
  if (host.endsWith("googleusercontent.com")) return true;
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(u.pathname);
}
