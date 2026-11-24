// The list of exams shown on the website (Exams page, Home page, footer, and the
// suggestions in Admin forms). It is edited in Admin → Exam Info → "Exams on the
// website" and stored in site settings under the key "exams_list" as JSON:
//   [{ "name": "CSIR NET", "blurb": "Physical Sciences · JRF…", "featured": true }, …]
// Order in the list = order on the site. "featured" = shown on the Home page.
// Until an admin saves a list, the defaults below are used.
import { EXAMS } from "./taxonomy.js";

export const EXAMS_SETTING_KEY = "exams_list";

const DEFAULT_BLURBS = {
  "CSIR NET": "Physical Sciences · JRF and lectureship",
  GATE: "Physics (PH) · M.Tech, PhD and PSU recruitment",
  JEST: "Physics · PhD and integrated PhD admissions",
};
const DEFAULT_FEATURED = ["CSIR NET", "GATE", "JEST"];

export const DEFAULT_EXAMS = [
  ...DEFAULT_FEATURED.map((name) => ({ name, blurb: DEFAULT_BLURBS[name] || "", featured: true })),
  ...EXAMS.filter((e) => !DEFAULT_FEATURED.includes(e)).map((name) => ({ name, blurb: "", featured: false })),
];

// Cleans whatever is stored (or typed) into a safe list: trimmed names, no
// blanks, no duplicates (case-insensitive), sensible lengths.
export function normalizeExams(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const name = String(raw?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, blurb: String(raw?.blurb ?? "").trim().slice(0, 160), featured: !!raw?.featured });
  }
  return out;
}

// From the site-settings object (as returned by api.getSettings()).
// Falls back to the defaults if nothing is saved or the saved text is broken.
export function examsFromSettings(settings) {
  const text = settings?.[EXAMS_SETTING_KEY];
  if (!text) return DEFAULT_EXAMS;
  try {
    const list = normalizeExams(JSON.parse(text));
    return list.length ? list : DEFAULT_EXAMS;
  } catch {
    return DEFAULT_EXAMS;
  }
}

export function examsToSetting(list) {
  return JSON.stringify(normalizeExams(list));
}
