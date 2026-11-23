import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { PLAN_IDS, PLAN_META, planName, setPlanNames } from "../lib/plans.js";

// Plan names and prices come from the database (Admin -> Plans & Prices) and are
// loaded once for the whole site, so renaming a plan there changes it on every
// page. If the request fails - or the migration has not been run yet - the four
// plans fall back to their default names with no prices, so pages still render.
const FALLBACK = PLAN_IDS.map((id, rank) => ({
  id, rank, name: PLAN_META[id].name, is_popular: id === "notes_mock", is_active: true,
}));

const PlansContext = createContext(null);

export function PlansProvider({ children }) {
  const [plans, setPlans] = useState(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => api.listPlans()
    .then((d) => setPlans(d.plans.length ? d.plans : FALLBACK))
    .catch(() => {})
    .finally(() => setLoaded(true)), []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => {
    setPlanNames(plans); // before children render, so planName() is already right
    return { plans: plans.filter((p) => p.is_active !== false), loaded, refresh, name: planName };
  }, [plans, loaded, refresh]);

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

export default function usePlans() {
  const ctx = useContext(PlansContext);
  return ctx || { plans: FALLBACK, loaded: false, refresh: () => {}, name: planName };
}

// For components that only need names: subscribes to renames, returns planName().
export function usePlanNames() {
  useContext(PlansContext);
  return planName;
}
