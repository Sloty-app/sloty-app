import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Splash          from "./pages/Splash";
import Auth            from "./pages/Auth";
import PrivacyPolicy   from "./pages/PrivacyPolicy";
import TermsOfService  from "./pages/TermsOfService";
import { MapPin } from "lucide-react";

// Lazy-loaded per role — a given session only ever needs ONE of these
// three (a user is always exactly one role), so code-splitting them
// keeps a customer's initial bundle from also shipping the owner and
// admin dashboards (and vice versa).
const CustomerApp = lazy(() => import("./pages/customer/CustomerApp"));
const OwnerApp     = lazy(() => import("./pages/owner/OwnerApp"));
const AdminApp     = lazy(() => import("./pages/admin/AdminApp"));

function FullScreenLoader() {
  return (
    <div className="splash-loader">
      <div style={{ textAlign: "center" }}>
        <div className="splash-loader__icon">
          <MapPin size={28} color="#fff" strokeWidth={2} />
        </div>
        <p style={{ color: "#fff", fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>Sloty</p>
        <p style={{ color: "rgba(255,255,255,0.45)", marginTop: 8, fontSize: 13 }}>Loading your experience...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, checking } = useAuth();

  if (checking) return <FullScreenLoader />;

  if (!user) return (
    <Routes>
      <Route path="/"            element={<Splash />} />
      <Route path="/auth/:role"  element={<Auth />} />
      <Route path="/privacy"     element={<PrivacyPolicy />} />
      <Route path="/terms"       element={<TermsOfService />} />
      <Route path="*"            element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms"   element={<TermsOfService />} />
        {user.role === "customer" && <Route path="/*" element={<CustomerApp />} />}
        {user.role === "owner"    && <Route path="/*" element={<OwnerApp />} />}
        {user.role === "admin"    && <Route path="/*" element={<AdminApp />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// The first page (role picker) and the sign-in pages are laid out as a
// centered block on a full-width page on desktop, instead of being
// squeezed into the same narrow phone-width column the logged-in app
// uses. Only those two get this — the privacy/terms pages are long
// text that needs a narrow measure, and every logged-in screen is
// still built as a single column. On phones nothing changes: the
// classes below only have an effect from 900px up (see index.css).
function Shell({ children }) {
  const { user, checking } = useAuth();
  const { pathname } = useLocation();
  const isEntryPage = !user && !checking && (pathname === "/" || pathname.startsWith("/auth/"));
  // Logged-in app: on desktop the bottom tab bar becomes a left sidebar
  // and list screens use the wider page (see index.css). role-* lets
  // the admin portal keep its own dark page background.
  const isMain = !!user && !checking;
  const role = user?.role;

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("entry-page", isEntryPage);
    el.classList.toggle("app-desktop", isMain);
    ["customer", "owner", "admin"].forEach(r => el.classList.toggle(`role-${r}`, isMain && role === r));
    return () => { el.classList.remove("entry-page", "app-desktop", "role-customer", "role-owner", "role-admin"); };
  }, [isEntryPage, isMain, role]);

  return <div className={`app-shell${isEntryPage ? " app-shell--entry" : ""}${isMain ? " app-shell--main" : ""}`}>{children}</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell>
          <AppRoutes />
        </Shell>
      </AuthProvider>
    </BrowserRouter>
  );
}
