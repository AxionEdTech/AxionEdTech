import React from "react";
import { Link } from "react-router-dom";
import NoticeBoard from "../components/NoticeBoard.jsx";
import { EXAMS } from "../taxonomy.js";

const TIERS = [
  {
    name: "Guest preview",
    tag: "No account needed",
    points: [
      "Browse the notice board and site",
      "Read a curated sample of notes and previous-year questions",
      "See every exam track we cover",
    ],
  },
  {
    name: "Free account",
    tag: "Sign up — no payment",
    points: [
      "Every free note and previous-year paper, in full",
      "Take mock tests and track your scores",
      "Upgrade to Paid any time",
    ],
  },
  {
    name: "Paid plan",
    tag: "Full access",
    points: [
      "Everything in Free, plus every note, paper and test marked \u201cPaid\u201d",
      "Priority access to newly added content",
      "Activated by an admin once payment is confirmed",
    ],
  },
];

export default function Home() {
  return (
    <div className="page dashboard-page home-page">
      <section className="dashboard-hero dashboard-hero-upgraded">
        <div className="hero-copy">
          <p className="eyebrow">Multi-exam preparation platform</p>
          <h1>Prepare smarter for CSIR NET, GATE &amp; more.</h1>
          <p className="dashboard-sub">
            Structured notes, previous-year papers, and full-length mock tests for Physics and
            interdisciplinary entrance examinations — organised by exam and syllabus topic.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/register">Create your free account</Link>
            <Link className="btn btn-ghost" to="/login">Log in</Link>
          </div>
          <p className="home-hero-note">
            Just looking around? <Link to="/notes">Browse sample notes</Link> or{" "}
            <Link to="/pyqs">sample papers</Link> — no account needed.
          </p>
        </div>
        <aside className="hero-exam-panel" aria-label="Supported exam tracks">
          <span className="hero-panel-label">Exam tracks</span>
          <strong>{EXAMS.length} pathways</strong>
          <p>Notes, past papers, and tests can be filtered to the examination you are targeting.</p>
          <div className="exam-chip-list">
            {EXAMS.slice(0, 5).map((exam) => <span key={exam}>{exam}</span>)}
            {EXAMS.length > 5 && <span>+{EXAMS.length - 5} more</span>}
          </div>
        </aside>
      </section>

      <NoticeBoard />

      <section className="dashboard-section tiers-section" aria-labelledby="tiers-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">How access works</p>
            <h2 id="tiers-heading">Start free, upgrade when you're ready</h2>
          </div>
          <p>No hidden catches — see exactly what each level unlocks before you sign up.</p>
        </div>
        <div className="tier-grid">
          {TIERS.map((t) => (
            <div key={t.name} className="tier-card">
              <span className="tier-tag">{t.tag}</span>
              <h3>{t.name}</h3>
              <ul>{t.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
