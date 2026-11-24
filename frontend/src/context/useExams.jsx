import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { DEFAULT_EXAMS, examsFromSettings } from "../lib/exams.js";
import { setExamOrder } from "../lib/taxonomy.js";

// The exams shown on the site, loaded once for every page. Edited in
// Admin → Exam Info → "Exams on the website"; see lib/exams.js.
//   exams     every exam, in site order: [{ name, blurb, featured }]
//   featured  the ones marked "Show on Home page"
//   names     just the names (for dropdowns and suggestions)
const ExamsContext = createContext(null);

function build(list) {
  setExamOrder(list.map((e) => e.name)); // before children render, so sorting is right
  return { exams: list, featured: list.filter((e) => e.featured), names: list.map((e) => e.name) };
}

export function ExamsProvider({ children }) {
  const [list, setList] = useState(DEFAULT_EXAMS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => api.getSettings()
    .then((s) => setList(examsFromSettings(s)))
    .catch(() => {})
    .finally(() => setLoaded(true)), []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ ...build(list), loaded, refresh }), [list, loaded, refresh]);
  return <ExamsContext.Provider value={value}>{children}</ExamsContext.Provider>;
}

export default function useExams() {
  return useContext(ExamsContext) || { ...build(DEFAULT_EXAMS), loaded: false, refresh: () => {} };
}
