import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="navbar">
      <Link to="/" className="brand-logo">
        Axion EdTech
      </Link>
      <nav className="navbar-links">
        <Link to="/notes">Notes</Link>
        <Link to="/pyqs">Previous Papers</Link>
        <Link to="/tests">Mock Tests</Link>
        <Link to="/results">My Results</Link>
        {user.role === "admin" && <Link to="/admin">Admin</Link>}
      </nav>
      <div className="navbar-user">
        <span className="navbar-username">{user.name}</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { logout(); navigate("/login"); }}
        >
          Log out
        </button>
      </div>
    </header>
  );
}
