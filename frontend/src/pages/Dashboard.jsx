import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

const CARDS = [
  { to: "/notes", label: "Study Notes", desc: "Unit-wise notes, read-only in your browser.", eyebrow: "01" },
  { to: "/pyqs", label: "Previous Year Papers", desc: "Past questions with answers & explanations.", eyebrow: "02" },
  { to: "/tests", label: "Mock Tests", desc: "Full-length tests in a real exam-style interface.", eyebrow: "03" },
  { to: "/results", label: "My Results", desc: "Review your attempts and score trends.", eyebrow: "04" }
];

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="dashboard-hero">
        <p className="eyebrow">PhD entrance exam prep</p>
        <h1>Welcome, {user.name.split(" ")[0]}.</h1>
        <p className="dashboard-sub">Steady, focused prep — pick up where you left off.</p>
      </div>
      <div className="card-grid">
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to} className="dash-card">
            <span className="dash-card-eyebrow">{c.eyebrow}</span>
            <h2>{c.label}</h2>
            <p>{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
