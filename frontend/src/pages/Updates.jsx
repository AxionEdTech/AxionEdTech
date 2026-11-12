import React, { useMemo, useState } from "react";
import useAnnouncements from "../useAnnouncements.js";
import { UpdateCard, UpcomingDates } from "../components/NoticeBoard.jsx";
import { UPDATE_CATEGORIES } from "../taxonomy.js";
import { monthKey } from "../updates.js";

// The notice board, rebuilt as an updates centre: filter by what kind of news
// it is, see upcoming dates at a glance, and read the rest as a dated feed.
export default function Updates() {
  const items = useAnnouncements();
  const [cat, setCat] = useState("");

  const shown = useMemo(() => (items || []).filter((a) => !cat || (a.category || "general") === cat), [items, cat]);
  const months = useMemo(() => {
    const map = new Map();
    for (const a of shown) {
      const k = monthKey(a.event_date ? `${a.event_date}T00:00:00` : a.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(a);
    }
    return [...map.entries()];
  }, [shown]);

  if (!items) return <div className="page-loading">Loading updates…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Notifications, deadlines and new material</p>
      <h1>Updates</h1>

      <div className="updates-layout">
        <div>
          <div className="exam-tabs">
            <button className={cat === "" ? "active" : ""} onClick={() => setCat("")}>All</button>
            {UPDATE_CATEGORIES.map((c) => (
              <button key={c.id} className={cat === c.id ? "active" : ""} onClick={() => setCat(c.id)}>{c.label}</button>
            ))}
          </div>
          {months.length === 0 && <p className="empty-state">Nothing here yet.</p>}
          {months.map(([month, list]) => (
            <section key={month} className="month-block">
              <h2>{month}</h2>
              <div className="grid grid-2">{list.map((a) => <UpdateCard key={a.id} a={a} full />)}</div>
            </section>
          ))}
        </div>
        <UpcomingDates limit={8} />
      </div>
    </div>
  );
}
