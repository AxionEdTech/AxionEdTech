import React from "react";
import usePlans from "../context/usePlans.jsx";
import PlanGrid, { PlanComparison } from "../components/PlanGrid.jsx";

const NOTES = [
  { q: "How do I pay?", a: "Choose a plan and billing period, pay using the instructions on the Subscribe page and send us the payment reference. Your plan is switched on once the payment is confirmed." },
  { q: "What if I renew before my plan ends?", a: "Renewing the same plan adds the new period after your current end date, so no time is lost." },
  { q: "What if I upgrade to a higher plan?", a: "The higher plan starts straight away for the period you buy." },
  { q: "What happens when a plan expires?", a: "Your account returns to Free. Your results, practice progress and bookmarks are kept." },
];

export default function Plans() {
  const { plans } = usePlans();
  return (
    <div className="page page-wide">
      <p className="eyebrow">Plans</p>
      <h1>Choose your plan</h1>
      <p className="page-sub">Higher plans include everything in the plans below them.</p>
      <PlanGrid plans={plans} />

      <h2 className="mt-xl">Compare plans</h2>
      <PlanComparison plans={plans} />

      <h2 className="mt-xl">Subscription questions</h2>
      <div className="acc-list">
        {NOTES.map((n) => (
          <details key={n.q} className="acc"><summary>{n.q}</summary><p>{n.a}</p></details>
        ))}
      </div>
    </div>
  );
}
