import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";

// One box at the top of the Admin page that checks the database updates
// (migrations) in order and, if one is missing, makes installing it a
// copy-and-paste: it carries the SQL itself and links straight to the SQL
// Editor of the Supabase project THIS site talks to.
//
// To add a future update: put the .sql file in supabase/migrations/, add it to
// scripts/sync-sql.mjs, run `npm run sync-sql`, then add an entry below with a
// status check from api.js.
const UPDATES = [
  {
    n: 4,
    check: () => api.databaseStatus(),
    load: () => import("../../sql/migration_4_hints_and_results_cleanup.sql?raw"),
    why: "Mock tests can't be saved, hints won't show in results, and results of deleted tests stay behind.",
    warn: "it only removes results of tests that no longer exist",
  },
  {
    n: 5,
    check: () => api.plansDatabaseStatus(),
    load: () => import("../../sql/migration_5_plans_papers_exam_hub_question_bank.sql?raw"),
    why: "Plans and subscriptions, previous-year papers, downloads, exam information, the question bank and the support inbox need it. It also stops students changing their own plan.",
    warn: "it only replaces its own older rules",
  },
  {
    n: 6,
    check: () => api.phoneDatabaseStatus(),
    load: () => import("../../sql/migration_6_phone_number_and_fixes.sql?raw"),
    why: "Phone numbers from the sign-up form are saved to student profiles, \"PYQs (text)\" can be saved again, and answers can't be sent in after a test's time is up.",
    warn: "it only changes rules it re-creates",
    expect: "true, true, true",
  },
  {
    n: 7,
    check: () => api.qbTopicsDatabaseStatus(),
    load: () => import("../../sql/migration_7_question_bank_topics.sql?raw"),
    why: "The Question Bank gets topics inside each unit (e.g. Vector Analysis), so questions can be added and practised topic by topic.",
    warn: "it only replaces the question-bank summary it re-creates",
    expect: "true, true",
  },
];

function projectRef() {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]; } catch { return null; }
}

export default function DatabaseUpdates() {
  const [state, setState] = useState({ phase: "checking" });
  const [sql, setSql] = useState("");
  const [copied, setCopied] = useState("");
  const ref = projectRef();

  const check = useCallback(async () => {
    setState({ phase: "checking" }); setSql(""); setCopied("");
    for (const u of UPDATES) {
      let r;
      try { r = await u.check(); } catch (err) { r = { state: "unknown", detail: err.message }; }
      if (r.state === "missing") return setState({ phase: "missing", update: u });
      if (r.state === "unknown") return setState({ phase: "unknown", update: u, detail: r.detail });
    }
    setState({ phase: "ok" });
  }, []);
  useEffect(() => { check(); }, [check]);

  const u = state.update;
  async function loadSql() {
    if (sql) return sql;
    const text = (await u.load()).default;
    setSql(text);
    return text;
  }
  async function copy() {
    const text = await loadSql();
    try { await navigator.clipboard.writeText(text); setCopied("ok"); } catch { setCopied("manual"); }
  }

  if (state.phase === "checking") return null;
  if (state.phase === "ok") {
    return (
      <p className="db-status ok">
        ✔ Database is up to date (update {UPDATES[UPDATES.length - 1].n}).{" "}
        <button type="button" className="btn-link" onClick={check}>Check again</button>
      </p>
    );
  }
  if (state.phase === "unknown") {
    return (
      <p className="db-status">
        Couldn't check database update {u.n} ({state.detail || "no details"}).{" "}
        <button type="button" className="btn-link" onClick={check}>Try again</button>
      </p>
    );
  }

  return (
    <div className="db-update" role="alert">
      <h3>Database update {u.n} needed</h3>
      <p>{u.why} It takes about a minute:</p>
      <ol>
        <li>
          <button type="button" className="btn btn-primary btn-sm" onClick={copy}>Copy the SQL</button>
          {copied === "ok" && <span className="db-copied"> Copied ✔</span>}
          {copied === "manual" && <span className="db-copied"> Your browser blocked copying — open "Show the SQL" below and copy it by hand.</span>}
        </li>
        <li>
          {ref ? (
            <a className="btn btn-ghost btn-sm" href={`https://supabase.com/dashboard/project/${ref}/sql/new`} target="_blank" rel="noopener noreferrer">
              Open this site's Supabase SQL Editor ↗
            </a>
          ) : (
            <span>Open your Supabase project → SQL Editor → New query.</span>
          )}
        </li>
        <li>
          Paste the SQL and press <strong>Run</strong>. If Supabase warns about "destructive operations", click{" "}
          <strong>Run this query</strong> — {u.warn}. The result at the bottom should show <strong>{u.expect || "true, true, true"}</strong>.
        </li>
        <li>Come back here and <button type="button" className="btn btn-ghost btn-sm" onClick={check}>Check again</button></li>
      </ol>
      <details onToggle={(e) => { if (e.currentTarget.open) loadSql(); }}>
        <summary>Show the SQL</summary>
        <textarea className="db-sql" readOnly rows={10} value={sql || "Loading…"} onFocus={(e) => e.currentTarget.select()} />
      </details>
    </div>
  );
}
