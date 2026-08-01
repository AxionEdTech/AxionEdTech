import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Safety net: no matter what happens below (slow network, a dropped
    // request, an unexpected error), never leave the app stuck on the
    // loading screen for more than 10 seconds.
    const timeout = setTimeout(() => { if (active) setLoading(false); }, 10000);

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (session) {
          try { setUser((await api.me()).user); } catch { setUser(null); }
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) { setLoading(false); clearTimeout(timeout); }
      }
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { setUser(null); return; }
      try { setUser((await api.me()).user); } catch { setUser(null); }
    });

    return () => { active = false; clearTimeout(timeout); sub.subscription.unsubscribe(); };
  }, []);

  function login(user) {
    setUser(user);
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
