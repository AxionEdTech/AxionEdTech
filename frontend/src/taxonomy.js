// Central controlled taxonomy for the whole portal.
// Editing this file is the ONLY place you change the list/order of exams,
// subjects and units. Admin dropdowns and the public grouping/ordering all
// read from here, so section names can never drift apart from typos.

export const EXAMS = ["CSIR NET", "GATE", "JEST", "TIFR", "GATE PH", "DU", "HCU", "BHU"];

export const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Life Sciences", "General"];

// Canonical units per subject, listed in SYLLABUS order (not alphabetical).
export const UNITS = {
  Physics: [
    "Mathematical Methods of Physics",
    "Classical Mechanics",
    "Electromagnetic Theory",
    "Quantum Mechanics",
    "Thermodynamic and Statistical Physics",
    "Electronics and Experimental Methods",
    "Atomic and Molecular Physics",
    "Condensed Matter Physics",
    "Nuclear and Particle Physics",
  ],
  Chemistry: [
    "Physical Chemistry",
    "Inorganic Chemistry",
    "Organic Chemistry",
    "Analytical Chemistry",
    "Interdisciplinary Topics",
  ],
  Mathematics: [
    "Analysis",
    "Linear Algebra",
    "Complex Analysis",
    "Algebra",
    "Topology",
    "Ordinary Differential Equations",
    "Partial Differential Equations",
    "Numerical Analysis",
    "Classical Mechanics",
    "Probability and Statistics",
  ],
  "Life Sciences": ["General"],
  General: ["General"],
};

// Helper: index of a value in an ordered list, with unknowns pushed to the end.
export function orderIndex(list, value) {
  const i = list.indexOf(value);
  return i === -1 ? 999 : i;
}

// Sort helpers used by the public pages so display order follows the taxonomy,
// then a sensible secondary key.
export function examRank(exam) {
  return orderIndex(EXAMS, exam || "General");
}
export function subjectRank(subject) {
  return orderIndex(SUBJECTS, subject || "General");
}
export function unitRank(subject, unit) {
  return orderIndex(UNITS[subject] || [], unit);
}
