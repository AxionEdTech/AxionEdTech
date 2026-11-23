import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { effectivePlan } from "../lib/plans.js";
import { usePlanNames } from "../context/usePlans.jsx";
import Icon from "./Icon.jsx";

const LINKS = [
  { to: "/exams", label: "Exams" },
  { to: "/notes", label: "Notes" },
  { to: "/tests", label: "Mock Tests" },
  { to: "/question-bank", label: "Question Bank" },
  { to: "/papers", label: "Previous Year Papers" },
  { to: "/downloads", label: "Downloads" },
  { to: "/plans", label: "Plans" },
];
// Less-used pages live under "More" on a wide screen, and are listed flat in the phone menu.
const MORE = [
  { to: "/updates", label: "Updates" },
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const plan = effectivePlan(user);
  const planName = usePlanNames();

  // Close the mobile menu whenever the page changes.
  useEffect(() => { setOpen(false); setMoreOpen(false); }, [location.pathname]);

  // Clicking anywhere else closes the More menu.
  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = (e) => { if (!e.target.closest?.(".nav-more")) setMoreOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [moreOpen]);

  const moreActive = MORE.some((m) => location.pathname.startsWith(m.to));

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link to="/" className="brand" aria-label="Axion EdTech home">
          <img src="/logo-mark.png" alt="" className="brand-mark" height="44" />
          <span className="brand-text">
            <strong>Axion <em>EdTech</em></strong>
            <small>Think. Learn. Evolve.</small>
          </span>
        </Link>

        <nav id="primary-nav" className={`site-nav-links${open ? " open" : ""}`} aria-label="Main">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          <div className="nav-more">
            <button type="button" className={`nav-more-btn${moreActive ? " active" : ""}`} aria-expanded={moreOpen} aria-haspopup="true" onClick={() => setMoreOpen((o) => !o)}>
              More <Icon name="down" size={14} />
            </button>
            <div className={`nav-more-menu${moreOpen ? " open" : ""}`}>
              {MORE.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
            </div>
          </div>
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <div className="site-nav-user">
          {user ? (
            <>
              <Link to="/dashboard" className="nav-account" title="Your dashboard">
                <Icon name="user" size={18} />
                <span className="nav-account-name">{user.name?.split(" ")[0]}</span>
                {plan !== "free" && <span className="plan-chip">{planName(plan)}</span>}
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate("/"); }}>Log out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login" state={["/", "/login", "/register"].includes(location.pathname) ? undefined : { from: location.pathname + location.search }}>Log in</Link>
              <Link className="btn btn-gold btn-sm" to="/register">Sign up free</Link>
            </>
          )}
          <button
            className="nav-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
            aria-controls="primary-nav" onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? "close" : "menu"} size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
