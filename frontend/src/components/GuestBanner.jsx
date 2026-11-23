import React from "react";
import { Link, useLocation } from "react-router-dom";

// Shown to signed-out visitors on Notes/PYQ so it's clear they're seeing a
// curated free sample, not the whole library. Logged-in users never see this.
export default function GuestBanner() {
  const location = useLocation();
  return (
    <div className="tier-banner">
      <span>You're viewing a free sample without an account — full free content unlocks after signing up.</span>
      <span className="tier-banner-actions">
        <Link to="/register" className="btn btn-primary btn-sm">Create free account</Link>
        <Link to="/login" state={{ from: location.pathname + location.search }} className="btn btn-ghost btn-sm">Log in</Link>
      </span>
    </div>
  );
}
