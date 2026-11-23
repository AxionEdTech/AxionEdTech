import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { api } from "../lib/api.js";

// Who is signed in, shared with every page through useAuth():
//   user     the student's profile row (name, email, role, plan, ...) or null
//   loading  true until the first check has finished
//   login(profile), logout(), refreshUser()
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef(null);

  const loadProfile = useCallback(async () => {
    try {
      const { user: profile } = await api.me();
      userIdRef.current = profile?.id ?? null;
      setUser(profile);
    } catch {
      userIdRef.current = null;
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Safety net: never leave the app on the loading screen for more than 10 s.
    const timeout = setTimeout(() => { if (active) setLoading(false); }, 10000);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (active && session) {
          userIdRef.current = session.user.id; // so the listener below doesn't load it twice
          await loadProfile();
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) { setLoading(false); clearTimeout(timeout); }
      }
    })();

    // Supabase calls this on sign-in, sign-out, and every hourly token refresh
    // (and often when the tab regains focus). Two rules:
    //  * Never await another Supabase call inside it — that can deadlock the
    //    client and leave pages stuck loading. setTimeout runs it afterwards.
    //  * Only reload the profile when the signed-in PERSON changed (or their
    //    account was updated). A token refresh is the same person; replacing the
    //    user object then made pages reload and lose what was on screen.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const id = session?.user?.id ?? null;
      if (!id) {
        userIdRef.current = null;
        setUser(null);
        return;
      }
      if (id !== userIdRef.current || event === "USER_UPDATED") {
        userIdRef.current = id;
        setTimeout(() => { if (active) loadProfile(); }, 0);
      }
    });

    return () => { active = false; clearTimeout(timeout); sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const login = useCallback((profile) => {
    userIdRef.current = profile?.id ?? null;
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally {
      userIdRef.current = null;
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser: loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
