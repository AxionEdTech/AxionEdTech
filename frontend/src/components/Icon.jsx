import React from "react";

// One small, consistent icon set (24px grid, 1.8 stroke) so every card and
// button in the site speaks the same visual language.
const PATHS = {
  notes: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6",
  mock: "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2 M9 14l2 2 4-4",
  bank: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  papers: "M3 7h18v4H3z M5 11v9h14v-9 M10 15h4",
  exam: "M2 9l10-5 10 5-10 5z M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M10 21a2 2 0 0 0 4 0",
  lock: "M6 11h12v10H6z M8 11V8a4 4 0 0 1 8 0v3",
  check: "M5 12.5l4.5 4.5L19 7.5",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5",
  user: "M12 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21a8 8 0 0 1 16 0",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  close: "M6 6l12 12 M18 6L6 18",
  right: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  bookmark: "M7 4h10v17l-5-4-5 4z",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  mail: "M3 6h18v12H3z M3 7l9 7 9-7",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.4-1.1 1-1.1 1.7 M12 17h.01",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  layers: "M12 3l9 5-9 5-9-5z M3 13l9 5 9-5",
  external: "M14 4h6v6 M20 4L10 14 M18 14v6H4V6h6",
  target: "M4 12h4 M16 12h4 M12 4v4 M12 16v4 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  download: "M12 3v12 M7 11l5 5 5-5 M5 21h14",
  sheet: "M5 3h14v18H5z M5 9h14 M5 15h14 M11 3v18",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z",
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M17.5 6.5h.01",
  youtube: "M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z M10 9l5 3-5 3z",
  telegram: "M22 2L11 13 M22 2l-7 20-4-9-9-4z",
  whatsapp: "M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z M9 9c0 3 3 6 6 6l1-2-2-1-1 .8c-1-.5-1.8-1.3-2.3-2.3L11 9.5 10 7.5z",
  xtwitter: "M4 4l16 16 M20 4L4 20",
  linkedin: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  facebook: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
};

export default function Icon({ name, size = 20, className = "", title }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      role={title ? "img" : undefined} aria-hidden={title ? undefined : "true"} aria-label={title}
    >
      {d.split(" M").map((seg, i) => <path key={i} d={i === 0 ? seg : `M${seg}`} />)}
    </svg>
  );
}
