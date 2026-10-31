import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

// The site's database needs a one-time SQL update (migration 4) for hints, safe
// saving of tests and results clean-up. This box checks whether it has been
// installed in the Supabase project THIS site talks to, and makes installing it
// a copy-and-paste: it carries the SQL itself, and links straight to that
// project's SQL Editor (so it can't be run in the wrong project by mistake).

function projectRef() {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]; } catch { return null; }
}

export default function DatabaseUpdatePanel() {
  const [status, setStatus] = useState({ state: "checking" });
  const [sql, setSql] = useState("");
  const [copied, setCopied] = useState("");
  const ref = projectRef();

  const check = useCallback(async () => {
    setStatus({ state: "checking" });
    try { setStatus(await api.databaseStatus()); } catch (err) { setStatus({ state: "unknown", detail: err.message }); }
  }, []);
  useEffect(() => { check(); }, [check]);

  async function loadSql() {
    if (sql) return sql;
    const mod = await import("../sql/migration_4_hints_and_results_cleanup.sql?raw");
    setSql(mod.default);
    return mod.default;
  }

  async function copy() {
    const text = await loadSql();
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("manual"); // clipboard blocked: the text box below can be copied by hand
    }
  }

  if (status.state === "checking") return <p className="db-status">Checking the database…</p>;

  if (status.state === "installed") {
    return (
      <p className="db-status ok">
        ✔ Database update installed — hints, safe saving and results clean-up are on.{" "}
        <button type="button" className="btn-link" onClick={check}>Check again</button>
      </p>
    );
  }

  if (status.state === "unknown") {
    return (
      <p className="db-status">
        Couldn't check the database update ({status.detail || "no details"}).{" "}
        <button type="button" className="btn-link" onClick={check}>Try again</button>
      </p>
    );
  }

  return (
    <div className="db-update" role="alert">
      <h3>One-time database update needed</h3>
      <p>
        Until this is done, mock tests can't be saved, hints won't show in results, and results of tests you
        delete stay behind. It takes about a minute:
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
        <li>Paste the SQL and press <strong>Run</strong>. If Supabase warns about "destructive operations", click <strong>Run this query</strong> — it only removes results of tests that no longer exist. The result at the bottom should show <strong>true, true, true</strong>.</li>
        <li>
          Come back here and <button type="button" className="btn btn-ghost btn-sm" onClick={check}>Check again</button>
        </li>
      </ol>
      <details onToggle={(e) => { if (e.currentTarget.open) loadSql(); }}>
        <summary>Show the SQL</summary>
        <textarea className="db-sql" readOnly rows={10} value={sql || "Loading…"} onFocus={(e) => e.currentTarget.select()} />
      </details>
    </div>
  );
}
