import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import usePlans from "../usePlans.jsx";
import { FEATURED_EXAMS, EXAMS } from "../taxonomy.js";
import PlanGrid from "../components/PlanGrid.jsx";
import NoticeBoard, { UpcomingDates } from "../components/NoticeBoard.jsx";
import { NoteCard, PaperCard, TestCard } from "../components/Cards.jsx";
import Icon from "../components/Icon.jsx";
import OrbitArt from "../components/OrbitArt.jsx";

const EXAM_BLURBS = {
  "CSIR NET": "Physical Sciences · JRF and lectureship",
  GATE: "Physics (PH) · M.Tech, PhD and PSU recruitment",
  JEST: "Physics · PhD and integrated PhD admissions",
};

const RESOURCES = [
  { to: "/notes", icon: "notes", title: "Study notes", text: "Topic-wise notes in syllabus order, with diagrams and equations.", tag: "Free + premium" },
  { to: "/tests", icon: "mock", title: "Mock tests", text: "Full-length, subject-wise and topic-wise tests, timed and auto-evaluated.", tag: "Mock plan" },
  { to: "/question-bank", icon: "bank", title: "Question bank", text: "Practise MCQ, multiple-select and numerical questions by topic.", tag: "Free sample + plans" },
  { to: "/papers", icon: "papers", title: "Previous Year Papers", text: "Every available paper by exam and year, opened right here as PDF.", tag: "Always free" },
  { to: "/exams", icon: "exam", title: "Exam information", text: "Patterns, syllabi, eligibility, cut-offs and calendars in one place.", tag: "Always free" },
  { to: "/downloads", icon: "download", title: "Downloads", text: "Sample notes and mock tests, cheat sheets and other files from Drive.", tag: "Free + premium" },
];

const WHY = [
  { icon: "papers", title: "Previous Year Papers stay free", text: "Every paper opens without an account." },
  { icon: "layers", title: "Plans that stack", text: "Each plan includes everything in the one below it." },
  { icon: "shield", title: "Answer keys stay on the server", text: "Question-bank and test answers are checked server-side, never sent to your browser in advance." },
  { icon: "target", title: "Built on the syllabus", text: "Notes and questions follow the unit order of the exams they prepare you for." },
];

export default function Home() {
  const { plans } = usePlans();
  const [tests, setTests] = useState([]);
  const [notes, setNotes] = useState([]);
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    let active = true;
    api.listTests().then((d) => active && setTests(d.tests)).catch(() => {});
    api.listNotes().then((d) => active && setNotes(d.notes)).catch(() => {});
    api.listPapers().then((d) => active && setPapers(d.papers)).catch(() => {});
    return () => { active = false; };
  }, []);

  const otherExams = EXAMS.filter((e) => !FEATURED_EXAMS.includes(e));
  const latestNotes = [...notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
  // Free items first, so the featured row always shows something a visitor can open.
  const featuredTests = [...tests].sort((a, b) => Number(b.min_plan === "free") - Number(a.min_plan === "free")).slice(0, 3);

  return (
    <div className="home">
      <section className="hero">
        <OrbitArt className="hero-orbit" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow light">CSIR NET · GATE · JEST</p>
            <h1>Physics exam preparation, organised topic by topic.</h1>
            <p className="hero-sub">
              Notes, mock tests, a practice question bank and every previous-year paper —
              arranged exam by exam, so you always know what to study next.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-gold btn-lg" to="/question-bank">Start practising</Link>
              <Link className="btn btn-outline-light btn-lg" to="/plans">View plans</Link>
            </div>
          </div>
          <UpcomingDates dark />
        </div>
      </section>

      <section className="section container" aria-labelledby="exams-h">
        <div className="section-head">
          <div><p className="eyebrow">Choose your exam</p><h2 id="exams-h">Start with your target exam</h2></div>
          <Link to="/exams" className="section-link">All exams <Icon name="arrow" size={16} /></Link>
        </div>
        <div className="grid grid-4">
          {FEATURED_EXAMS.map((exam) => (
            <Link key={exam} to={`/exams/${encodeURIComponent(exam)}`} className="card card-hover exam-card">
              <span className="card-icon lg"><Icon name="exam" size={24} /></span>
              <h3>{exam}</h3>
              <p className="card-meta">{EXAM_BLURBS[exam]}</p>
              <p className="paper-chips"><span>Pattern</span><span>Syllabus</span><span>Cut-offs</span><span>Calendar</span></p>
            </Link>
          ))}
          {otherExams.length > 0 && (
            <Link to="/exams" className="card card-hover exam-card exam-card-more">
              <span className="card-icon lg"><Icon name="layers" size={24} /></span>
              <h3>More exams</h3>
              <p className="card-meta">{otherExams.slice(0, 5).join(" · ")}{otherExams.length > 5 ? " and more" : ""}</p>
            </Link>
          )}
        </div>
      </section>

      <section className="section container" aria-labelledby="res-h">
        <div className="section-head">
          <div><p className="eyebrow">Learning resources</p><h2 id="res-h">Everything in one place</h2></div>
        </div>
        <div className="grid grid-3">
          {RESOURCES.map((r) => (
            <Link key={r.to} to={r.to} className="card card-hover res-card">
              <div className="card-top"><span className="card-icon lg"><Icon name={r.icon} size={24} /></span><span className="tier-badge tier-info">{r.tag}</span></div>
              <h3>{r.title}</h3>
              <p className="card-meta">{r.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section band" aria-labelledby="plans-h">
        <div className="container">
          <div className="section-head">
            <div><p className="eyebrow">Plans</p><h2 id="plans-h">Pick what you need — each plan includes the one below</h2></div>
            <Link to="/plans" className="section-link">Compare all features <Icon name="arrow" size={16} /></Link>
          </div>
          <PlanGrid plans={plans} />
        </div>
      </section>

      {featuredTests.length > 0 && (
        <section className="section container" aria-labelledby="tests-h">
          <div className="section-head">
            <div><p className="eyebrow">Mock tests</p><h2 id="tests-h">Featured mock tests</h2></div>
            <Link to="/tests" className="section-link">All tests <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="grid grid-3">{featuredTests.map((t) => <TestCard key={t.id} t={t} />)}</div>
        </section>
      )}

      {latestNotes.length > 0 && (
        <section className="section container" aria-labelledby="notes-h">
          <div className="section-head">
            <div><p className="eyebrow">Study materials</p><h2 id="notes-h">Newly added notes</h2></div>
            <Link to="/notes" className="section-link">All notes <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="grid grid-3">{latestNotes.map((n) => <NoteCard key={n.id} n={n} />)}</div>
        </section>
      )}

      {papers.length > 0 && (
        <section className="section container" aria-labelledby="papers-h">
          <div className="section-head">
            <div><p className="eyebrow">Always free</p><h2 id="papers-h">Previous Year Papers</h2></div>
            <Link to="/papers" className="section-link">All papers <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="grid grid-4">{papers.slice(0, 4).map((p) => <PaperCard key={p.id} p={p} />)}</div>
        </section>
      )}

      <div className="container"><NoticeBoard limit={4} /></div>

      <section className="section container" aria-labelledby="why-h">
        <div className="section-head"><div><p className="eyebrow">Why Axion EdTech</p><h2 id="why-h">Built for serious preparation</h2></div></div>
        <div className="grid grid-4">
          {WHY.map((w) => (
            <div key={w.title} className="why-item">
              <span className="card-icon"><Icon name={w.icon} size={20} /></span>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
