// Single source of truth for the subscription model on the front end.
// The database enforces access (see supabase/migration_4…): this file only
// decides what to SHOW. Plans overlap — each plan includes everything in the
// plans below it — so a feature is defined once, at the plan where it first
// appears, and every higher plan gets it automatically.

export const PLAN_IDS = ["free", "mock", "notes_mock", "complete"];

export function planRank(id) {
  const i = PLAN_IDS.indexOf(id);
  return i === -1 ? 0 : i;
}

export const PLAN_META = {
  free: { name: "Free", tagline: "Start preparing today", cta: "Create free account" },
  mock: { name: "Mock Test", tagline: "Test yourself under exam conditions" },
  notes_mock: { name: "Notes + Mock", tagline: "Learn the theory, then test it" },
  complete: { name: "Complete", tagline: "Everything, including what we add next" },
};

// Billing periods. `column` is the matching price column in the plans table.
export const PERIODS = [
  { id: "monthly", label: "Monthly", months: 1, column: "price_monthly" },
  { id: "quarterly", label: "3 months", months: 3, column: "price_quarterly" },
  { id: "half_yearly", label: "6 months", months: 6, column: "price_half_yearly" },
  { id: "yearly", label: "Yearly", months: 12, column: "price_yearly" },
];

// `since` = the lowest plan that includes the feature. `soon` = not built yet;
// shown honestly as "Soon" instead of being sold as if it already worked.
export const FEATURES = [
  { since: "free", label: "Every previous-year paper, as PDF" },
  { since: "free", label: "Exam patterns, syllabi, cut-offs and calendars" },
  { since: "free", label: "Updates, deadlines and admit-card alerts" },
  { since: "free", label: "Sample notes and sample mock tests" },
  { since: "free", label: "Sample practice questions with solutions" },
  { since: "free", label: "Bookmarks and practice progress tracking" },
  { since: "mock", label: "Topic-wise, subject-wise and full-length mock tests" },
  { since: "mock", label: "Timed exams with automatic evaluation" },
  { since: "mock", label: "Answer review and score history after every test" },
  { since: "notes_mock", label: "All premium study notes, topic by topic" },
  { since: "notes_mock", label: "Practice question bank, core sets" },
  { since: "complete", label: "Full question bank, including advanced sets" },
  { since: "complete", label: "Every new note, test and question set we add" },
  { since: "complete", label: "Written step-by-step test solutions", soon: true },
  { since: "complete", label: "Subject-wise and time-management analytics", soon: true },
];

// Features a plan ADDS on top of the one below it (used on the pricing cards).
export function featuresAddedBy(planId) {
  return FEATURES.filter((f) => f.since === planId);
}

export function planIncludes(planId, feature) {
  return planRank(planId) >= planRank(feature.since);
}

// What plan actually applies to this profile right now. Mirrors the
// database's current_plan(); the server is the authority, this only drives UI.
export function effectivePlan(profile, now = new Date()) {
  if (!profile) return "free";
  if (profile.role === "admin") return "complete";
  const plan = PLAN_IDS.includes(profile.plan) ? profile.plan : "free";
  if (plan === "free") return "free";
  if (profile.plan_expires_at && new Date(profile.plan_expires_at) <= now) return "free";
  return plan;
}

export function daysLeft(expiresAt, now = new Date()) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt) - now) / 86400000);
}

export function formatPrice(amount) {
  if (amount === null || amount === undefined || amount === "") return null;
  return `\u20B9${Number(amount).toLocaleString("en-IN")}`;
}

// Periods that at least one paid plan has a price for, in display order.
export function activePeriods(plans) {
  return PERIODS.filter((p) => plans.some((pl) => pl.id !== "free" && pl[p.column] != null));
}

// Plan names. The names an admin types in Admin → Plans & Prices are the ones
// shown everywhere; PLAN_META's names are only the starting defaults. The
// provider in usePlans.jsx calls setPlanNames() whenever the plans load or change.
let NAMES = {};
export function setPlanNames(plans) {
  NAMES = Object.fromEntries((plans || []).filter((p) => p.name).map((p) => [p.id, p.name]));
}
export function planName(id) {
  return NAMES[id] || PLAN_META[id]?.name || "Paid";
}

// Label shown on a content item for the plan it needs.
export function planBadge(minPlan) {
  return planName(!minPlan ? "free" : minPlan);
}

// Compare two plans for the call-to-action: "current", "included", or "upgrade".
export function planRelation(current, target) {
  if (current === target) return "current";
  return planRank(current) > planRank(target) ? "included" : "upgrade";
}
