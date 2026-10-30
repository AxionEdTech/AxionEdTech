import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Notes from "./pages/Notes.jsx";
import NoteView from "./pages/NoteView.jsx";
import PYQ from "./pages/PYQ.jsx";
import MockTestList from "./pages/MockTestList.jsx";
import MockTestAttempt from "./pages/MockTestAttempt.jsx";
import MockTestResult from "./pages/MockTestResult.jsx";
import MyResults from "./pages/MyResults.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";

function Shell({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

// Logged-in visitors land on their Dashboard, same as before. Signed-out
// visitors now get a real public Home page instead of being bounced straight
// to the login form — that's where the notice board and free preview live.
function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Shell><Home /></Shell>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomeGate />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<ProtectedRoute><Shell><Dashboard /></Shell></ProtectedRoute>} />

        {/* Notes and Previous Papers are open to everyone — Row Level Security
            decides how much of the content a guest vs. free vs. paid visitor
            actually receives, so no login gate is needed at the route level. */}
        <Route path="/notes" element={<Shell><Notes /></Shell>} />
        <Route path="/notes/:id" element={<Shell><NoteView /></Shell>} />
        <Route path="/pyqs" element={<Shell><PYQ /></Shell>} />

        {/* The test catalog (titles/metadata, never questions) follows the same
            guest/free/paid tiering as Notes and PYQs. Starting an attempt still
            always requires an account, since a score has to belong to somebody. */}
        <Route path="/tests" element={<Shell><MockTestList /></Shell>} />
        {/* :testId is a TEST id, not an attempt id — see MockTestList.start() */}
        <Route path="/tests/attempt/:testId" element={<ProtectedRoute><MockTestAttempt /></ProtectedRoute>} />
        <Route path="/tests/result/:attemptId" element={<ProtectedRoute><Shell><MockTestResult /></Shell></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><Shell><MyResults /></Shell></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Shell><AdminPanel /></Shell></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
