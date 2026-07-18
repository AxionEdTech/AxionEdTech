import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

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
    </>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<ProtectedRoute><Shell><Dashboard /></Shell></ProtectedRoute>} />
        <Route path="/notes" element={<ProtectedRoute><Shell><Notes /></Shell></ProtectedRoute>} />
        <Route path="/notes/:id" element={<ProtectedRoute><Shell><NoteView /></Shell></ProtectedRoute>} />
        <Route path="/pyqs" element={<ProtectedRoute><Shell><PYQ /></Shell></ProtectedRoute>} />
        <Route path="/tests" element={<ProtectedRoute><Shell><MockTestList /></Shell></ProtectedRoute>} />
        <Route path="/tests/attempt/:testId" element={<ProtectedRoute><MockTestAttempt /></ProtectedRoute>} />
        <Route path="/tests/result/:attemptId" element={<ProtectedRoute><Shell><MockTestResult /></Shell></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><Shell><MyResults /></Shell></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Shell><AdminPanel /></Shell></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
