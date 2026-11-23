import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { driveDownloadUrl } from "../lib/drivePdf.js";
import { safeUrl } from "../lib/links.js";
import { orderCategories } from "../lib/social.js";
import { planBadge } from "../lib/plans.js";
import { TierBadge } from "../components/Cards.jsx";
import { usePlanNames } from "../context/usePlans.jsx";
import Icon from "../components/Icon.jsx";

const ICONS = {
  "Previous Year Papers": "papers",
  "Sample Notes": "notes",
  "Sample Mock Tests": "mock",
  "Mock Tests": "mock",
  "Cheat Sheets": "sheet",
};

// Drive-hosted files: papers, sample material, cheat sheets and anything else
// added in Admin → Downloads. Locked items show their title and the plan they
// need; the Drive link itself is only sent to students whose plan allows it.
export default function Downloads() {
  const { user } = useAuth();
  usePlanNames();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [exam, setExam] = useState("");

  useEffect(() => {
    api.listDownloads().then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }, [user]);

  const categories = useMemo(() => orderCategories((items || []).map((i) => i.category)), [items]);
  const exams = useMemo(() => [...new Set((items || []).map((i) => i.exam).filter(Boolean))].sort(), [items]);
  const shown = useMemo(
    () => (items || []).filter((i) => (!category || i.category === category) && (!exam || i.exam === exam)),
    [items, category, exam]
  );
  const groups = useMemo(() => orderCategories(shown.map((i) => i.category)).map((c) => [c, shown.filter((i) => i.category === c)]), [shown]);

  if (!items && !error) return <div className="page-loading">Loading downloads…</div>;

  return (
    <div className="page page-wide">
      <p className="eyebrow">Files you can keep</p>
      <h1>Downloads</h1>
      {error && <div className="form-error">{error}</div>}

      {items && items.length > 0 && (
        <div className="toolbar">
          <div className="exam-tabs">
            <button className={category === "" ? "active" : ""} onClick={() => setCategory("")}>All</button>
            {categories.map((c) => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          {exams.length > 1 && (
            <select className="filter-select" value={exam} onChange={(e) => setExam(e.target.value)} aria-label="Filter by exam">
              <option value="">All exams</option>
              {exams.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
        </div>
      )}

      {items && items.length === 0 && <p className="empty-state">Nothing has been added yet — check back soon.</p>}

      {groups.map(([name, list]) => (
        <section key={name} className="paper-block">
          {!category && <h2>{name}</h2>}
          <div className="grid grid-3">
            {list.map((d) => <DownloadCard key={d.id} d={d} signedIn={!!user} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function DownloadCard({ d, signedIn }) {
  const location = useLocation();
  const open = d.has_access ? safeUrl(d.link_url) : null;
  const save = d.has_access ? (driveDownloadUrl(d.link_url) || open) : null;
  return (
    <article className={`card${d.has_access ? "" : " is-locked"}`}>
      <div className="card-top">
        <span className="card-icon"><Icon name={d.has_access ? (ICONS[d.category] || "download") : "lock"} size={20} /></span>
        <TierBadge minPlan={d.min_plan} />
      </div>
      <h3>{d.title}</h3>
      {d.description && <p className="card-meta">{d.description}</p>}
      <p className="card-meta">{d.category}{d.exam ? ` · ${d.exam}` : ""}</p>
      <div className="card-action download-actions">
        {open ? (
          <>
            <a className="btn btn-navy" href={open} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} /> Open</a>
            <a className="btn btn-ghost" href={save} target="_blank" rel="noopener noreferrer"><Icon name="download" size={15} /> Download</a>
          </>
        ) : signedIn ? (
          <Link className="btn btn-gold btn-block" to={`/subscribe?plan=${d.min_plan}`}><Icon name="lock" size={15} /> Unlock with {planBadge(d.min_plan)}</Link>
        ) : (
          <Link className="btn btn-navy btn-block" to="/login" state={{ from: location.pathname + location.search }}>Log in to access</Link>
        )}
      </div>
    </article>
  );
}
