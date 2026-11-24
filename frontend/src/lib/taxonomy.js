// Central controlled taxonomy for the whole portal.
// Editing this file is where you change the list/order of subjects and units.
// Admin dropdowns and the public grouping/ordering all read from here, so
// section names can never drift apart from typos. (The list of exams is
// edited on the Admin page instead — see lib/exams.js.)

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

// Some exams (CSIR NET, for one) are held more than once a year. This list
// only drives sort order and the datalist suggestion in the PYQ admin form —
// any exam can be given any session label, or none at all (a plain year).
export const SESSIONS = ["June", "December"];

// Helper: index of a value in an ordered list, with unknowns pushed to the end.
export function orderIndex(list, value) {
  const i = list.indexOf(value);
  return i === -1 ? 999 : i;
}

// Sort helpers used by the public pages so display order follows the taxonomy,
// then a sensible secondary key.
// Exams sort in the order of the admin-edited exam list (Admin → Exam Info →
// "Exams on the website"); setExamOrder() is called once that list loads.
let examOrder = EXAMS;
export function setExamOrder(names) {
  if (Array.isArray(names) && names.length) examOrder = names;
}
export function examRank(exam) {
  return orderIndex(examOrder, exam || "General");
}
export function subjectRank(subject) {
  return orderIndex(SUBJECTS, subject || "General");
}
export function unitRank(subject, unit) {
  return orderIndex(UNITS[subject] || [], unit);
}
// No session (an exam held once a year) sorts before a named session, so an
// un-tagged year doesn't get stranded in the middle of that year's sittings.
export function sessionRank(session) {
  return session ? orderIndex(SESSIONS, session) : -1;
}

// The exams shown on the site are now edited in Admin → Exam Info → "Exams on the
// website" (see lib/exams.js and context/useExams.jsx). EXAMS above is only the
// starting list used until that is saved.

// Sections of the Exams hub, in the order they appear as tabs.
export const EXAM_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "pattern", label: "Exam pattern" },
  { id: "syllabus", label: "Syllabus" },
  { id: "eligibility", label: "Eligibility" },
  { id: "cutoffs", label: "Cut-offs" },
  { id: "calendar", label: "Calendar & dates" },
  { id: "strategy", label: "Preparation" },
  { id: "faq", label: "FAQ" },
];

// Categories for the Updates centre.
export const UPDATE_CATEGORIES = [
  { id: "exam_notice", label: "Exam notification" },
  { id: "deadline", label: "Deadline" },
  { id: "admit_card", label: "Admit card" },
  { id: "new_material", label: "New material" },
  { id: "new_test", label: "New test" },
  { id: "general", label: "General" },
];

export const DIFFICULTIES = ["easy", "medium", "hard"];
export const QUESTION_TYPES = [
  { id: "mcq", label: "MCQ" },
  { id: "msq", label: "Multiple select" },
  { id: "nat", label: "Numerical" },
];

export const TEST_KINDS = [
  { id: "full", label: "Full-length" },
  { id: "subject", label: "Subject-wise" },
  { id: "topic", label: "Topic-wise" },
  { id: "pyq_style", label: "PYQ-style" },
];
