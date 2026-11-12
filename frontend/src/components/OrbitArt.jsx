import React from "react";

// Decorative orbit motif echoing the logo (three tilted orbits and a gold
// nucleus). Pure SVG, so it stays sharp and adds nothing to page weight.
export default function OrbitArt({ className = "" }) {
  return (
    <svg className={`orbit-art ${className}`} viewBox="0 0 400 400" fill="none" aria-hidden="true">
      <g strokeWidth="3" strokeLinecap="round">
        <ellipse cx="200" cy="200" rx="170" ry="62" transform="rotate(-28 200 200)" stroke="#F5A000" opacity=".85" />
        <ellipse cx="200" cy="200" rx="170" ry="62" transform="rotate(32 200 200)" stroke="#0057A8" opacity=".9" />
        <ellipse cx="200" cy="200" rx="170" ry="62" transform="rotate(90 200 200)" stroke="#7FB2E5" opacity=".55" />
      </g>
      <circle cx="200" cy="200" r="15" fill="#F0BA43" />
      <circle cx="200" cy="200" r="26" fill="#F0BA43" opacity=".18" />
    </svg>
  );
}
