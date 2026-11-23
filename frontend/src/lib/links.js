// Links typed into the admin screens (social profiles, Drive files, update
// links) end up in <a href>. Only plain web addresses are allowed through, so a
// stray "javascript:" link can never become clickable.
export function safeUrl(input) {
  const text = (input || "").trim();
  if (!text) return null;
  try {
    const u = new URL(text);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
