import React, { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
// The Markdown/maths renderer is large, so it loads on demand instead of with the first page.
const RichContent = lazy(() => import("./RichContent.jsx"));
import useAnnouncements from "../context/useAnnouncements.js";
import { categoryLabel, daysUntil, formatDay, upcomingDates } from "../lib/updates.js";
import Icon from "./Icon.jsx";
import { safeUrl } from "../lib/links.js";

// One update as a card: category, title, message, and — when the update has a
// date attached — the date itself, counted down if it is still ahead.
export function UpdateCard({ a, full = false }) {
  const ahead = a.event_date ? daysUntil(a.event_date) : null;
  return (
    <article className={`update-card cat-${a.category || "general"}${a.is_pinned ? " pinned" : ""}`}>
      <header>
        <span className="cat-pill">{categoryLabel(a.category)}</span>
        {a.is_pinned && <span className="pin-tag">Pinned</span>}
      </header>
      <h3>{a.title}</h3>
      <div className={full ? "" : "update-clamp"}><Suspense fallback={null}><RichContent text={a.body} className="notice-body" /></Suspense></div>
      <footer>
        {a.event_date ? (
          <span className={`update-date${ahead !== null && ahead >= 0 && ahead <= 7 ? " soon" : ""}`}>
            <Icon name="calendar" size={14} /> {formatDay(a.event_date)}
            {ahead !== null && ahead >= 0 && <em>{ahead === 0 ? "today" : ahead === 1 ? "tomorrow" : `in ${ahead} days`}</em>}
          </span>
        ) : (
          <span className="update-date">{formatDay(a.created_at.slice(0, 10))}</span>
        )}
        {safeUrl(a.link_url) && (
          <a className="update-link" href={safeUrl(a.link_url)} target="_blank" rel="noopener noreferrer">
            Details <Icon name="external" size={13} />
          </a>
        )}
      </footer>
    </article>
  );
}

// Compact latest-updates grid for the Home page and Dashboard.
export default function NoticeBoard({ limit = 4, eyebrow = "Updates", title = "Latest updates" }) {
  const items = useAnnouncements();
  if (!items || items.length === 0) return null;
  return (
    <section className="section" aria-label={title}>
      <div className="section-head">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
        <Link to="/updates" className="section-link">All updates <Icon name="arrow" size={16} /></Link>
      </div>
      <div className="grid grid-4">{items.slice(0, limit).map((a) => <UpdateCard key={a.id} a={a} />)}</div>
    </section>
  );
}

// "Next dates" strip: deadlines and exam dates that are still ahead.
export function UpcomingDates({ limit = 4, dark = false }) {
  const items = useAnnouncements();
  const next = items ? upcomingDates(items).slice(0, limit) : [];
  if (next.length === 0) return null;
  return (
    <aside className={`dates-panel${dark ? " dark" : ""}`} aria-label="Upcoming dates">
      <h3><Icon name="calendar" size={18} /> Upcoming dates</h3>
      <ul>
        {next.map((a) => {
          const n = daysUntil(a.event_date);
          return (
            <li key={a.id}>
              <span className="dates-when"><strong>{formatDay(a.event_date)}</strong><em>{n === 0 ? "today" : `${n} d`}</em></span>
              <span className="dates-what">{a.title}</span>
            </li>
          );
        })}
      </ul>
      <Link to="/updates" className="section-link">All updates <Icon name="arrow" size={16} /></Link>
    </aside>
  );
}
