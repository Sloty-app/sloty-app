import { useNavigate } from "react-router-dom";
import { C } from "../constants";
import { MapPin, User, Store, ChevronRight } from "lucide-react";

// Seventh pass. Every attempt so far — including matching Auth.jsx's
// header — still didn't land, because Auth's shell (translucent icon
// badge, accent-dot label, decorative blurred circles, negative-
// margin overlap) is actually a heavier, more ornamented treatment
// than what the app's real day-to-day screen — the customer home
// screen — uses. That hero is much simpler: a plain gradient panel
// (135deg, C.pri to C.priDark), rounded bottom corners only (no
// overlap trick), no decorative circles, no icon-in-a-badge — just
// a greeting and an avatar sitting directly in the gradient, then
// content starts flush below on the plain background. This copies
// that exact, plainer treatment instead.
export default function Splash() {
  const navigate = useNavigate();

  // Admin intentionally has no card here — accessed only via a direct
  // URL (/auth/admin), never shown publicly.
  const roles = [
    {
      role:"customer",
      Icon:User,
      label:"I'm a Customer",
      sub:"Book slots near you, skip the wait",
      color:C.pri,
    },
    {
      role:"owner",
      Icon:Store,
      label:"I'm a Store Owner",
      sub:"Manage bookings, grow your business",
      color:C.blue,
    },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", display:"flex", flexDirection:"column" }}>

      <div style={{ background:`linear-gradient(135deg,${C.pri} 0%,${C.priDark} 100%)`, padding:"48px 20px 28px", borderBottomLeftRadius:36, borderBottomRightRadius:36, textAlign:"center" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:6 }}>
          <MapPin size={20} color="#fff" strokeWidth={2} />
          <h1 style={{ fontSize:24, fontWeight:900, color:"#fff" }}>Sloty</h1>
        </div>
        <p style={{ fontSize:13, color:"rgba(255,255,255,0.75)" }}>Skip the wait. Book your slot.</p>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 20px" }}>
        <div style={{ width:"100%", maxWidth:340 }}>

          <p style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:14, textAlign:"center" }}>Choose how you'd like to continue</p>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {roles.map(({ role, Icon, label, sub, color }) => (
              <button
                key={role}
                onClick={() => navigate(`/auth/${role}`)}
                style={{
                  padding:"18px 20px", background:C.card, border:"none", borderRadius:20, cursor:"pointer",
                  fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:14, textAlign:"left",
                  boxShadow:"0 2px 12px rgba(26,26,46,0.06)", transition:"transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(26,26,46,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(26,26,46,0.06)"; }}
              >
                <div style={{ width:48, height:48, borderRadius:15, background:color+"15", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Icon size={23} color={color} strokeWidth={1.8} />
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:15, fontWeight:900, color:C.text, marginBottom:2 }}>{label}</p>
                  <p style={{ fontSize:12, color:C.muted, fontWeight:600 }}>{sub}</p>
                </div>
                <ChevronRight size={18} color={C.muted} />
              </button>
            ))}
          </div>

          <div style={{ marginTop:32, textAlign:"center" }}>
            <p style={{ fontSize:11, color:C.muted, marginBottom:6 }}>
              By continuing, you agree to our
            </p>
            <div style={{ display:"flex", gap:6, justifyContent:"center", alignItems:"center", fontSize:11, fontWeight:700 }}>
              <span onClick={() => navigate("/terms")} style={{ color:C.muted, cursor:"pointer", textDecoration:"underline" }}>Terms of Service</span>
              <span style={{ color:"#C5CAD8" }}>&</span>
              <span onClick={() => navigate("/privacy")} style={{ color:C.muted, cursor:"pointer", textDecoration:"underline" }}>Privacy Policy</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
