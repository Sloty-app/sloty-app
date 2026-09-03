import { createContext, useContext, useState, useEffect } from "react";
import { api, saveToken, clearToken } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (localStorage.getItem("bmt_token")) {
        try {
          const res = await api("GET", "/auth/me");
          setUser(res.user);
        } catch { clearToken(); }
      }
      setChecking(false);
    };
    checkAuth();
  }, []);

  const login  = (u, token) => {
    // Each role app remembers its last-viewed tab in sessionStorage so a
    // page refresh doesn't dump you back on Home — but that same value
    // was surviving a fresh login too, so logging in always resumed
    // wherever the previous session (or previous user, on a shared
    // device) happened to leave off, instead of starting at Home/
    // Dashboard/Overview like a real login should.
    sessionStorage.removeItem("sloty-customer-tab");
    sessionStorage.removeItem("sloty-owner-tab");
    sessionStorage.removeItem("sloty-admin-tab");
    saveToken(token);
    setUser(u);
  };
  const logout = ()         => { clearToken(); setUser(null); };
  const refreshUser = async () => {
    try {
      const res = await api("GET", "/auth/me");
      setUser(res.user);
    } catch { /* ignore */ }
  };

  return (
    <AuthContext.Provider value={{ user, checking, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
