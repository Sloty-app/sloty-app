import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
