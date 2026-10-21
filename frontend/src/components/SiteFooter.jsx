import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { normalizeImageSrc } from "../driveImage.js";

// Shown on every page via Shell (App.jsx) — deliberately not shown on the
// exam-attempt screen, which renders outside Shell so nothing distracts from
// an active test. Content is editable from Admin → Author, no redeploy needed.
export default function SiteFooter() {
  const [authors, setAuthors] = useState(null);

  useEffect(() => {
    let active = true;
    api.listAuthors()
      .then((d) => { if (active) setAuthors(d.authors.filter((a) => a.is_active)); })
      .catch(() => { if (active) setAuthors([]); }); // a footer should never block the page on an error
    return () => { active = false; };
  }, []);

  return (
    <footer className="site-footer">
      {authors && authors.length > 0 && (
        <div className="footer-authors">
          {authors.map((a) => (
            <div key={a.id} className="footer-author">
              {a.photo_url && (
                <img
                  src={normalizeImageSrc(a.photo_url)}
                  alt={a.name}
                  className="footer-author-photo"
                  loading="lazy"
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
