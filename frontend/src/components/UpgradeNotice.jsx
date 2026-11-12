import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { usePlanNames } from "../usePlans.jsx";
import Icon from "./Icon.jsx";

// Shown wherever a student reaches something their plan doesn't include.
export default function UpgradeNotice({ minPlan = "notes_mock", what = "content", title }) {
  const { user } = useAuth();
  const nameOf = usePlanNames();
  const planName = minPlan ? nameOf(minPlan) : "a paid";
  return (
    <div className="locked-card">
      <span className="locked-icon"><Icon name="lock" size={26} /></span>
      <h2>{title || `This ${what} is part of the ${planName} plan`}</h2>
      <p className="page-sub">
        {user
          ? `Your current plan doesn't include it. Upgrade to ${planName} (or higher) to open it.`
          : "Log in or create a free account first — then pick the plan that suits you."}
      </p>
      <div className="hero-actions">
        {user ? (
          <Link className="btn btn-gold" to={`/subscribe?plan=${minPlan}`}>Upgrade to {planName}</Link>
        ) : (
          <>
            <Link className="btn btn-gold" to="/register">Create free account</Link>
            <Link className="btn btn-ghost" to="/login">Log in</Link>
          </>
        )}
        <Link className="btn btn-ghost" to="/plans">Compare plans</Link>
      </div>
    </div>
  );
}
