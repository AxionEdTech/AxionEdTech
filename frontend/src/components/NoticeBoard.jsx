import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import RichContent from "../richContent.jsx";

// Shown on both the public Home page and the logged-in Dashboard, so every
// visitor — guest or student — sees the same updates. `limit` trims the list
// for the compact Dashboard placement; leave it unset to show everything.
export default function NoticeBoard({ limit }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let active = true;
    api.listAnnouncements()
      .then((d) => { if (active) setItems(d.announcements.filter((a) => a.is_active)); })
      .catch(() => { if (active) setItems([]); }); // a marketing/dashboard section should never block on an error
    return () => { active = false; };
  }, []);

  if (!items || items.length === 0) return null;
  const shown = limit ? items.slice(0, limit) : items;

  return (
    <section className="notice-board" aria-label="Latest updates">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Notice board</p>
          <h2>Latest updates</h2>
        </div>
      </div>
      <div className="notice-list">
        {shown.map((a) => (
          <article key={a.id} className={`notice-card${a.is_pinned ? " pinned" : ""}`}>
            {a.is_pinned && <span className="notice-pin">Pinned</span>}
            <h3>{a.title}</h3>
            <RichContent text={a.body} className="notice-body" />
            <span className="notice-date">
              {new Date(a.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
