import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

// Migration 5 (plans, previous-year papers, downloads, exam information, question
// bank, updates centre, support inbox). Same idea as the migration 4 box: it
// checks whether the SQL is installed in the Supabase project THIS site talks
// to, and when it is not, makes installing it a copy-and-paste. Once installed
// it shows nothing.

function projectRef() {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]; } catch { return null; }
}

export default function PlansUpdatePanel() {
  const [status, setStatus] = useState({ state: "checking" });
  const [sql, setSql] = useState("");
  const [copied, setCopied] = useState("");
  const ref = projectRef();

  const check = useCallback(async () => {
    setStatus({ state: "checking" });
    try { setStatus(await api.plansDatabaseStatus()); } catch (err) { setStatus({ state: "unknown", detail: err.message }); }
  }, []);
  useEffect(() => { check(); }, [check]);

  async function loadSql() {
    if (sql) return sql;
    const mod = await import("../sql/migration_5_plans_papers_exam_hub_question_bank.sql?raw");
    setSql(mod.default);
    return mod.default;
  }

  async function copy() {
    const text = await loadSql();
    try { await navigator.clipboard.writeText(text); setCopied("ok"); } catch { setCopied("manual"); }
  }

  if (status.state === "checking" || status.state === "installed") return null;

  if (status.state === "unknown") {
    return (
      <p className="db-status">
        Couldn't check the plans database update ({status.detail || "no details"}).{" "}
        <button type="button" className="btn-link" onClick={check}>Try again</button>
      </p>
    );
  }

  return (
    <div className="db-update" role="alert">
      <h3>Database update 5 needed</h3>
      <p>
        Plans and subscriptions, previous-year papers, downloads, exam information, the question bank and the support
        inbox need one more database update. It also closes a hole that let students change their own plan.
        Install the earlier update (the box under Mock Tests) first if it still asks for it. This takes about a minute:
      </p>
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
        <li>Paste the SQL and press <strong>Run</strong>. If Supabase warns about "destructive operations", click <strong>Run this query</strong> — it only replaces its own older rules. The result at the bottom should show <strong>true, true, true</strong>.</li>
        <li>Come back here and <button type="button" className="btn btn-ghost btn-sm" onClick={check}>Check again</button></li>
      </ol>
      <details onToggle={(e) => { if (e.currentTarget.open) loadSql(); }}>
        <summary>Show the SQL</summary>
        <textarea className="db-sql" readOnly rows={10} value={sql || "Loading…"} onFocus={(e) => e.currentTarget.select()} />
      </details>
    </div>
  );
}
