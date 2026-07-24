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

  const login  = (u, token) => { saveToken(token); setUser(u); };
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
