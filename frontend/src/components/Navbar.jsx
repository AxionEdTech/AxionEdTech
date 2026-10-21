import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <img src="/logo.png" alt="" className="navbar-logo" width="36" height="36" />
        <span className="navbar-title">Axion<em>EdTech</em></span>
      </Link>
      <nav className="navbar-links">
        <Link to="/notes">Notes</Link>
        <Link to="/pyqs">Previous Papers</Link>
        <Link to="/tests">Mock Tests</Link>
        {user && <Link to="/results">My Results</Link>}
        {user?.role === "admin" && <Link to="/admin">Admin</Link>}
      </nav>
      <div className="navbar-user">
        {user ? (
          <>
            <span className="navbar-username">
              {user.name}
              {user.plan === "paid" && <span className="plan-badge">Paid</span>}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { logout(); navigate("/"); }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link className="btn btn-ghost btn-sm" to="/login">Log in</Link>
            <Link className="btn btn-primary btn-sm" to="/register">Sign up free</Link>
          </>
        )}
      </div>
    </header>
  );
}
