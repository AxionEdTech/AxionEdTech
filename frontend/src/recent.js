// "Recently viewed notes" lives in this browser only (no account data needed).
// Every read is wrapped: private browsing or blocked storage must never break a page.
const KEY = "axion.recentNotes";

export function getRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function pushRecent(note) {
  try {
    const list = getRecent().filter((n) => n.id !== note.id);
    list.unshift({ id: note.id, title: note.title, exam: note.exam, subject: note.subject });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 6)));
  } catch { /* ignore */ }
}
