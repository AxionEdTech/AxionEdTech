// Marking patterns for mock tests. Picking one in the test form fills in each
// question's marks and negative marks from the question's Part, so a full test
// is scored exactly like the real paper without typing "Marks:" on every question.
//
// CSIR NET Physical Sciences: 75 questions, 200 marks, 3 hours, 25% negative
// marking in every part. Re-check against the current NTA notification
// before relying on it for a new exam cycle.
//
// `attempt` (how many a candidate may answer) is kept for the test engine's
// "first N answered per part are scored" rule; it is not enforced yet.

export const EXAM_PATTERNS = {
  csir_net_physics: {
    id: "csir_net_physics",
    name: "CSIR NET — Physical Sciences",
    duration: 180,
    parts: [
      { part: "A", label: "Part A", total: 20, attempt: 15, marks: 2, negative: 0.5 },
      { part: "B", label: "Part B", total: 25, attempt: 20, marks: 3.5, negative: 0.875 },
      { part: "C", label: "Part C", total: 30, attempt: 20, marks: 5, negative: 1.25 },
    ],
  },
};

// Returns the questions with marks / negative_marks set from each one's Part.
// Questions whose part isn't in the pattern are left exactly as they were.
export function applyPattern(questions, pattern) {
  if (!pattern) return questions;
  return questions.map((q) => {
    const rule = pattern.parts.find((p) => p.part === String(q.part || "").toUpperCase());
    return rule ? { ...q, marks: rule.marks, negative_marks: rule.negative } : q;
  });
}

// How the questions entered so far compare with the real paper, part by part.
export function patternSummary(questions, pattern) {
  if (!pattern) return [];
  return pattern.parts.map((rule) => {
    const have = questions.filter((q) => String(q.part || "").toUpperCase() === rule.part).length;
    return {
      part: rule.part,
      label: rule.label,
      have,
      total: rule.total,
      complete: have === rule.total,
      message: have === rule.total
        ? `${rule.label}: ${have} questions (matches the real paper)`
        : `${rule.label}: ${have} of ${rule.total} questions`,
    };
  });
}
