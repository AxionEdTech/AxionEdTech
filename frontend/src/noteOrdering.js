// Single source of truth for "what order do notes appear in" — used by both
// the public Notes page and the admin reorder screen, so students always see
// exactly what the admin arranged.
//
// Every note optionally carries a `position` (a plain integer, set only by
// the admin's Reorder screen). A note without one falls back to the existing
// syllabus order (exam -> subject -> unit from taxonomy.js), offset well
// above any real position — so untouched content keeps its familiar order,
// and the moment an admin moves anything, that note (and everything grouped
// with it) is free to move anywhere, including above older content.
import { examRank, subjectRank, unitRank } from "./taxonomy.js";

const UNPOSITIONED_OFFSET = 1_000_000_000;

function fallbackRank(n) {
  return examRank(n.exam) * 1_000_000 + subjectRank(n.subject) * 1_000 + unitRank(n.subject, n.unit);
}

export function effectiveRank(n) {
  return n.position != null ? n.position : UNPOSITIONED_OFFSET + fallbackRank(n);
}

// Groups notes into topic sections, each already sorted, and returns the
// sections themselves in display order. `splitByExam: true` labels each
// section with its exam (used when several exams are shown together);
// `false` drops the exam name (used once a single exam tab is selected).
export function groupNotes(notes, { splitByExam = true } = {}) {
  const groups = new Map();
  for (const n of notes) {
    const key = splitByExam
      ? `${n.exam || "General"} · ${n.subject ? n.subject + " — " : ""}${n.unit}`
      : (n.subject ? `${n.subject} — ${n.unit}` : n.unit);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }
  const sections = [...groups.entries()].map(([key, items]) => {
    const sortedItems = items.slice().sort((a, b) => effectiveRank(a) - effectiveRank(b) || a.id - b.id);
    return { key, items: sortedItems, rank: Math.min(...sortedItems.map(effectiveRank)) };
  });
  sections.sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));
  return sections;
}

// Flattens an (admin-reordered) list of sections back into a fresh set of
// explicit positions, spaced 10 apart to keep numbers easy to reason about.
export function assignPositions(sections) {
  const updates = [];
  let counter = 10;
  for (const section of sections) {
    for (const n of section.items) {
      updates.push({ id: n.id, position: counter });
      counter += 10;
    }
  }
  return updates;
}
