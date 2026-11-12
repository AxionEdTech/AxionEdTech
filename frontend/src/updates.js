// Pure helpers for the Updates centre (kept free of React so they can be tested).
import { UPDATE_CATEGORIES } from "./taxonomy.js";

export function categoryLabel(id) {
  return UPDATE_CATEGORIES.find((c) => c.id === id)?.label || "General";
}

// Pinned first, then newest first.
export function sortUpdates(items) {
  return [...items].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

// Items with an event date that is today or later, soonest first.
export function upcomingDates(items, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return items
    .filter((a) => a.event_date && new Date(`${a.event_date}T00:00:00`) >= start)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
}

export function daysUntil(dateStr, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(`${dateStr}T00:00:00`) - start) / 86400000);
}

export function formatDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Month heading used to group the feed ("November 2026").
export function monthKey(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
