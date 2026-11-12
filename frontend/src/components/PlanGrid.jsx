import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import {
  FEATURES, PLAN_IDS, PLAN_META, activePeriods, effectivePlan, featuresAddedBy,
  formatPrice, planIncludes, planName, planRank, planRelation,
} from "../plans.js";
import Icon from "./Icon.jsx";

// The four overlapping plans as pricing cards. Prices and the "popular" flag
// come from the database (Admin → Plans); what each plan includes comes from
// plans.js, where every feature is defined once at the lowest plan that has it.
export default function PlanGrid({ plans }) {
  const { user } = useAuth();
  const current = effectivePlan(user);
  const periods = activePeriods(plans);
  const [periodId, setPeriodId] = useState(null);

  // Prefer 3 months as the starting view when it has prices.
  useEffect(() => {
    if (!periods.length) return;
    if (!periods.some((p) => p.id === periodId)) {
      setPeriodId((periods.find((p) => p.id === "quarterly") || periods[0]).id);
    }
  }, [periods, periodId]);

  const period = periods.find((p) => p.id === periodId) || null;

  return (
    <div>
      {periods.length > 1 && (
        <div className="period-toggle" role="group" aria-label="Billing period">
          {periods.map((p) => (
            <button key={p.id} type="button" className={p.id === periodId ? "active" : ""} onClick={() => setPeriodId(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="plan-grid">
        {PLAN_IDS.map((id) => {
          const plan = plans.find((p) => p.id === id);
          if (!plan) return null;
          return <PlanCard key={id} plan={plan} period={period} current={current} signedIn={!!user} isAdmin={user?.role === "admin"} />;
        })}
      </div>
    </div>
  );
}

function PlanCard({ plan, period, current, signedIn, isAdmin }) {
  const id = plan.id;
  const meta = PLAN_META[id];
  const below = PLAN_IDS[planRank(id) - 1];
  const price = id === "free" ? 0 : period ? plan[period.column] : null;
  const hasPrice = price !== null && price !== undefined;
  const relation = planRelation(current, id);
  const subscribeTo = `/subscribe?plan=${id}${period ? `&period=${period.id}` : ""}`;

  let cta;
  if (id === "free") {
    cta = signedIn
      ? <span className="btn btn-ghost btn-block is-static">{current === "free" ? "Your plan" : "Included"}</span>
      : <Link className="btn btn-navy btn-block" to="/register">{meta.cta}</Link>;
  } else if (relation === "included") {
    cta = <span className="btn btn-ghost btn-block is-static">Included in your plan</span>;
  } else if (!hasPrice) {
    cta = <Link className="btn btn-ghost btn-block" to="/contact">Ask about this plan</Link>;
  } else if (relation === "current") {
    cta = <Link className="btn btn-gold btn-block" to={subscribeTo}>Renew</Link>;
  } else {
    cta = (
      <Link className={`btn btn-block ${plan.is_popular ? "btn-gold" : "btn-navy"}`} to={subscribeTo}>
        {current === "free" ? "Subscribe" : "Upgrade"}
      </Link>
    );
  }

  return (
    <article className={`plan-card${plan.is_popular ? " popular" : ""}${signedIn && relation === "current" ? " is-current" : ""}`}>
      {plan.is_popular && <span className="plan-ribbon"><Icon name="star" size={13} /> Most popular</span>}
      <h3>{plan.name || meta.name}</h3>
      <p className="plan-tagline">{meta.tagline}</p>

      <div className="plan-price">
        {id === "free" ? (
          <strong>{"\u20B9"}0</strong>
        ) : hasPrice ? (
          <>
            <strong>{formatPrice(price)}</strong>
            <span>/ {period.months === 1 ? "month" : period.label.toLowerCase()}</span>
          </>
        ) : (
          <strong className="plan-price-soon">Pricing soon</strong>
        )}
      </div>
      {hasPrice && id !== "free" && period.months > 1 && (
        <p className="plan-price-sub">about {formatPrice(Math.round(price / period.months))} a month</p>
      )}
      {!hasPrice && id !== "free" && isAdmin && <p className="plan-price-sub">Set prices in Admin → Plans</p>}

      <ul className="plan-features">
        {below && <li className="plan-inherit"><Icon name="layers" size={16} /> Everything in {planName(below)}</li>}
        {featuresAddedBy(id).map((f) => (
          <li key={f.label}>
            <Icon name="check" size={16} />
            <span>{f.label}{f.soon && <em className="soon-tag">Soon</em>}</span>
          </li>
        ))}
      </ul>
      <div className="plan-cta">{cta}</div>
    </article>
  );
}

// Feature-by-feature table: one row per feature, one column per plan.
export function PlanComparison({ plans }) {
  const ordered = PLAN_IDS.map((id) => plans.find((p) => p.id === id)).filter(Boolean);
  return (
    <div className="compare-wrap" role="region" aria-label="Plan comparison" tabIndex={0}>
      <table className="compare">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            {ordered.map((p) => <th scope="col" key={p.id} className={p.is_popular ? "popular" : ""}>{p.name || planName(p.id)}</th>)}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((f) => (
            <tr key={f.label}>
              <th scope="row">{f.label}{f.soon && <em className="soon-tag">Soon</em>}</th>
              {ordered.map((p) => (
                <td key={p.id} className={p.is_popular ? "popular" : ""}>
                  {planIncludes(p.id, f)
                    ? (f.soon ? <span className="compare-soon">Soon</span> : <Icon name="check" size={18} className="compare-yes" title="Included" />)
                    : <span className="compare-no" aria-label="Not included">{"\u2014"}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
