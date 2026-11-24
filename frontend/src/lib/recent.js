// "Recently viewed notes" lives in this browser only (no account data needed).
// Every read is wrapped: private browsing or blocked storage must never break a page.
const KEY = "axion.recentNotes";

export function getRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 6))); } catch { /* ignore */ }
}

export function pushRecent(note) {
  const list = getRecent().filter((n) => n.id !== note.id);
  list.unshift({ id: note.id, title: note.title, exam: note.exam, subject: note.subject });
  save(list);
}

export function removeRecent(id) {
  save(getRecent().filter((n) => String(n.id) !== String(id)));
}

// Keeps only notes that still exist (and picks up renamed titles), given the
// current list of notes from the site. Returns the cleaned list and stores it,
// so a deleted note disappears from "Recently viewed" for good.
export function syncRecent(currentNotes) {
  const byId = new Map((currentNotes || []).map((n) => [String(n.id), n]));
  const cleaned = getRecent()
    .filter((n) => byId.has(String(n.id)))
    .map((n) => {
      const live = byId.get(String(n.id));
      return { id: live.id, title: live.title, exam: live.exam, subject: live.subject };
    });
  save(cleaned);
  return cleaned;
}
