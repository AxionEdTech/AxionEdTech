import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import RichContent from "../components/RichContent.jsx";
import { socialLinks } from "../lib/social.js";
import Icon from "../components/Icon.jsx";

const OFFER = [
  { icon: "notes", title: "Study Notes", text: "Written topic by topic, in the order of the syllabus." },
  { icon: "mock", title: "Mock Tests", text: "Timed and auto-evaluated, with your answers reviewed afterwards." },
  { icon: "bank", title: "Question Bank", text: "Topic-wise MCQ, multiple-select and numerical practice." },
  { icon: "papers", title: "Previous Year Papers", text: "Free for everyone, opened directly on the site." },
  { icon: "download", title: "Downloads", text: "Sample material, cheat sheets and papers you can keep." },
  { icon: "exam", title: "Exam Information", text: "Patterns, syllabi, eligibility, cut-offs and calendars." },
];

// The introduction below is the default. Anything saved under "About text" in
// Admin → Settings & Social replaces it without a redeploy; the social
// handles come from the same screen.
export default function About() {
  const [settings, setSettings] = useState({});
  useEffect(() => { api.getSettings().then(setSettings).catch(() => {}); }, []);
  const socials = socialLinks(settings);

  return (
    <div className="page page-wide">
      <p className="eyebrow">About us</p>
      <h1>About Axion EdTech</h1>

      <div className="about-grid">
        <div>
          {settings.about_text ? (
            <RichContent text={settings.about_text} className="about-text" />
          ) : (
            <div className="about-text">
              <p>
                Axion EdTech is a dedicated physics platform for aspirants of CSIR-UGC NET Physical Sciences,
                GATE Physics (PH), JEST, TIFR GS and other competitive examinations.
              </p>
              <p>
                The aim is simple: good material, arranged so you can see what to study next, with every
                previous-year paper free to open and practise from.
              </p>
            </div>
          )}
          <p className="about-tagline">Think. Learn. Evolve.</p>
        </div>

        <aside className="card find-us" aria-label="Find us online">
          <h2>Find us online</h2>
          {socials.length === 0 && !settings.support_email && <p className="card-meta">Links are being added.</p>}
          <ul className="social-list">
            {socials.map((s) => (
              <li key={s.key}>
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  <span className="social-icon"><Icon name={s.icon} size={20} /></span>
                  <span>{s.label}</span>
                  <Icon name="external" size={14} className="social-ext" />
                </a>
              </li>
            ))}
            {settings.support_email && (
              <li>
                <a href={`mailto:${settings.support_email}`}>
                  <span className="social-icon"><Icon name="mail" size={20} /></span>
                  <span>{settings.support_email}</span>
                </a>
              </li>
            )}
          </ul>
        </aside>
      </div>

      <h2 className="mt-xl">What you will find here</h2>
      <div className="grid grid-3">
        {OFFER.map((o) => (
          <div key={o.title} className="why-item">
            <span className="card-icon"><Icon name={o.icon} size={20} /></span>
            <h3>{o.title}</h3>
            <p>{o.text}</p>
          </div>
        ))}
      </div>

      <div className="hero-actions mt-lg">
        <Link className="btn btn-gold" to="/plans">View plans</Link>
        <Link className="btn btn-ghost" to="/contact">Contact us</Link>
      </div>
    </div>
  );
}
