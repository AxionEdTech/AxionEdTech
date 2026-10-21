// A Google Drive "share" link (drive.google.com/file/d/ID/view?usp=sharing,
// or drive.google.com/open?id=ID) opens Drive's HTML viewer page, not the
// image itself — so it can't be used directly as an <img src>. This pulls
// the file ID out of any of Drive's link shapes and rebuilds a URL that
// actually renders as a picture when hotlinked, as long as the file's
// sharing is set to "Anyone with the link can view".
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

// Rewrites a Drive share link to the hotlinkable form wherever one shows up
// as an <img src> — used both for note/PYQ/question content and for the
// author photo in the site footer, so there's one place this logic lives.
export function normalizeImageSrc(src) {
  if (!src || !/drive\.google\.com/.test(src)) return src;
  const id = extractDriveFileId(src);
  return id ? `https://lh3.googleusercontent.com/d/${id}=w1000` : src;
}
