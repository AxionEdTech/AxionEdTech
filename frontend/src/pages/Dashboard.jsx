import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { EXAMS } from "../taxonomy.js";

const RESOURCES = [
  { to: "/notes", number: "01", title: "Study Notes", description: "Numbered notes organised by exam, subject, and unit.", action: "Browse notes" },
  { to: "/pyqs", number: "02", title: "Previous Papers", description: "Read and solve past questions in a continuous question-booklet format.", action: "Open papers" },
  { to: "/tests", number: "03", title: "Mock Tests", description: "Practise in a focused, full-length exam interface.", action: "Take a test" },
  { to: "/results", number: "04", title: "My Results", description: "Review completed attempts and use them to steer your next session.", action: "View results" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Scholar";
  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero dashboard-hero-upgraded">
        <div className="hero-copy">
          <p className="eyebrow">Multi-exam preparation platform</p>
          <h1>Prepare with a plan, {firstName}.</h1>
          <p className="dashboard-sub">One focused workspace for Physics and interdisciplinary entrance examinations. Select your exam, build concepts systematically, and practise with real questions.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/notes">Start studying</Link>
            <Link className="btn btn-ghost" to="/pyqs">Practice previous papers</Link>
          </div>
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
      <section className="dashboard-section" aria-labelledby="resource-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Your preparation desk</p><h2 id="resource-heading">Choose where to continue</h2></div>
          <p>Switch tracks without losing structure: every resource remains organised by exam and syllabus topic.</p>
        </div>
        <div className="card-grid">
          {RESOURCES.map((resource) => (
            <Link key={resource.to} to={resource.to} className="dash-card">
              <span className="dash-card-eyebrow">{resource.number}</span>
              <h3>{resource.title}</h3><p>{resource.description}</p>
              <span className="dash-card-action">{resource.action} <span aria-hidden="true">-&gt;</span></span>
            </Link>
          ))}
        </div>
      </section>
      <section className="dashboard-workflow" aria-label="Preparation workflow">
        <div><span>01</span><strong>Select an exam</strong><p>Use exam tabs to focus notes and past papers on your target.</p></div>
        <div><span>02</span><strong>Build concepts</strong><p>Follow numbered notes in syllabus order, including diagrams and images.</p></div>
        <div><span>03</span><strong>Test and review</strong><p>Attempt questions and mocks, then use results to plan your next session.</p></div>
      </section>
    </div>
  );
}
