// Turns a Google Drive share link for a PDF into the address of Drive's
// embeddable viewer, so a paper opens inside the page (in an <iframe>)
// instead of sending the student away to drive.google.com.
//
// The file must be shared as "Anyone with the link can view", otherwise the
// viewer shows a sign-in wall. A bare file ID (no URL) is accepted as well.
import { extractDriveFileId } from "./driveImage.js";

const BARE_ID_RE = /^[a-zA-Z0-9_-]{20,}$/;

export function parseDriveFileId(input) {
  const text = (input || "").trim();
  if (!text) return null;
  const fromUrl = extractDriveFileId(text);
  if (fromUrl) return fromUrl;
  return BARE_ID_RE.test(text) ? text : null;
}

export function drivePreviewUrl(input) {
  const id = parseDriveFileId(input);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

// Plain "open in Drive" address, used only as a fallback link under the viewer.
export function driveViewUrl(input) {
  const id = parseDriveFileId(input);
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
}

// Direct-download address for a Drive file (the browser saves it instead of previewing).
export function driveDownloadUrl(input) {
  const id = parseDriveFileId(input);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
}
