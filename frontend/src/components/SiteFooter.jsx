import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { normalizeImageSrc } from "../driveImage.js";
import { FEATURED_EXAMS } from "../taxonomy.js";
import { socialLinks } from "../social.js";
import Icon from "./Icon.jsx";

// Shown on every page via Shell (App.jsx) — deliberately not on the
// exam-attempt screen, so nothing distracts from an active test. Contact
// details and the author block are editable in Admin (Settings / Author).
export default function SiteFooter() {
  const [authors, setAuthors] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    let active = true;
    api.listAuthors()
      .then((d) => { if (active) setAuthors(d.authors.filter((a) => a.is_active)); })
      .catch(() => { if (active) setAuthors([]); });
    api.getSettings().then((s) => { if (active) setSettings(s); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <span className="footer-logo"><img src="/logo.png" alt="Axion EdTech" width="120" height="120" loading="lazy" /></span>
          <p>Physics exam preparation for CSIR NET, GATE, JEST and more.</p>
          {settings.support_email && <a href={`mailto:${settings.support_email}`}>{settings.support_email}</a>}
          {socialLinks(settings).length > 0 && (
            <div className="footer-social" aria-label="Social media">
              {socialLinks(settings).map((s) => (
                <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}><Icon name={s.icon} size={18} /></a>
              ))}
            </div>
          )}
        </div>
        <nav aria-label="Prepare">
          <h4>Prepare</h4>
          <Link to="/notes">Notes</Link>
          <Link to="/tests">Mock Tests</Link>
          <Link to="/question-bank">Question Bank</Link>
          <Link to="/papers">Previous Year Papers</Link>
          <Link to="/downloads">Downloads</Link>
        </nav>
        <nav aria-label="Exams">
          <h4>Exams</h4>
          {FEATURED_EXAMS.map((e) => <Link key={e} to={`/exams/${encodeURIComponent(e)}`}>{e}</Link>)}
          <Link to="/exams">All exams</Link>
        </nav>
        <nav aria-label="Axion EdTech">
          <h4>Axion EdTech</h4>
          <Link to="/about">About Us</Link>
          <Link to="/plans">Plans &amp; pricing</Link>
          <Link to="/updates">Updates</Link>
          <Link to="/contact">Contact &amp; support</Link>
        </nav>
      </div>

      {authors && authors.length > 0 && (
        <div className="footer-authors">
          {authors.map((a) => (
            <div key={a.id} className="footer-author">
              {a.photo_url && (
                <img
                  src={normalizeImageSrc(a.photo_url)} alt={a.name} className="footer-author-photo" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              )}
              <div className="footer-author-info">
                <strong>{a.name}</strong>
                {a.bio && <p>{a.bio}</p>}
                <div className="footer-author-links">
                  {a.instagram_url && <a href={a.instagram_url} target="_blank" rel="noopener noreferrer">Instagram</a>}
                  {a.youtube_url && <a href={a.youtube_url} target="_blank" rel="noopener noreferrer">YouTube</a>}
                  {a.website_url && <a href={a.website_url} target="_blank" rel="noopener noreferrer">Website</a>}
                  {a.email && <a href={`mailto:${a.email}`}>{a.email}</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="footer-copyright">© {new Date().getFullYear()} Axion EdTech. All rights reserved.</p>
    </footer>
  );
}
