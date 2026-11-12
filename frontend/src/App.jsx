import React, { lazy, Suspense } from "react";
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
const NoteView = lazy(() => import("./pages/NoteView.jsx"));
const PYQ = lazy(() => import("./pages/PYQ.jsx"));
import MockTestList from "./pages/MockTestList.jsx";
const MockTestAttempt = lazy(() => import("./pages/MockTestAttempt.jsx"));
const MockTestResult = lazy(() => import("./pages/MockTestResult.jsx"));
import MyResults from "./pages/MyResults.jsx";
const AdminPanel = lazy(() => import("./pages/AdminPanel.jsx"));
import Plans from "./pages/Plans.jsx";
import { PlansProvider } from "./usePlans.jsx";
const Subscribe = lazy(() => import("./pages/Subscribe.jsx"));
import Papers from "./pages/Papers.jsx";
const PaperView = lazy(() => import("./pages/PaperView.jsx"));
import ExamHub from "./pages/ExamHub.jsx";
const ExamDetail = lazy(() => import("./pages/ExamDetail.jsx"));
import Updates from "./pages/Updates.jsx";
import Downloads from "./pages/Downloads.jsx";
const QuestionBank = lazy(() => import("./pages/QuestionBank.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
import Contact from "./pages/Contact.jsx";

function Shell({ children }) {
  return (
    <>
      <Navbar />
      <main className="app-main">{children}</main>
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
      <PlansProvider>
      <Suspense fallback={<div className="page-loading">Loading…</div>}>
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

        {/* Free, public resources: PDF papers, exam information, updates. */}
        <Route path="/papers" element={<Shell><Papers /></Shell>} />
        <Route path="/papers/:id" element={<Shell><PaperView /></Shell>} />
        <Route path="/exams" element={<Shell><ExamHub /></Shell>} />
        <Route path="/exams/:exam" element={<Shell><ExamDetail /></Shell>} />
        <Route path="/updates" element={<Shell><Updates /></Shell>} />
        <Route path="/downloads" element={<Shell><Downloads /></Shell>} />
        <Route path="/question-bank" element={<Shell><QuestionBank /></Shell>} />
        <Route path="/plans" element={<Shell><Plans /></Shell>} />
        <Route path="/subscribe" element={<ProtectedRoute><Shell><Subscribe /></Shell></ProtectedRoute>} />
        <Route path="/about" element={<Shell><About /></Shell>} />
        <Route path="/contact" element={<Shell><Contact /></Shell>} />

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
      </Suspense>
      </PlansProvider>
    </AuthProvider>
  );
}
