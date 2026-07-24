export const BASE = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export const getToken   = () => localStorage.getItem("bmt_token");
export const saveToken  = (t) => localStorage.setItem("bmt_token", t);
export const clearToken = () => localStorage.removeItem("bmt_token");

export const api = async (method, endpoint, data = null) => {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const config = { method, headers };
  if (data) config.body = JSON.stringify(data);
  try {
    const res  = await fetch(`${BASE}${endpoint}`, config);
    const json = await res.json().catch(() => ({}));
    // Only treat a 401 as "your session expired" if we actually sent a
    // token and the server rejected it — that means we thought we were
    // logged in but weren't. If no token was sent, this 401 is just a
    // normal "wrong credentials" response from a login attempt (nothing
    // was ever logged in), and should surface as a regular error instead
    // of force-redirecting to a specific role's login screen.
    if (res.status === 401 && token) {
      clearToken();
      window.location.href = "/auth/customer";
      throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) throw new Error(json.message || "Something went wrong");
    return json;
  } catch (err) {
    if (err.message === "Failed to fetch") {
      throw new Error("Cannot reach server. Check your connection and try again.");
    }
    throw err;
  }
};
