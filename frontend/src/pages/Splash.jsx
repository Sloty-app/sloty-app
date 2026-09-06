import { useNavigate } from "react-router-dom";
import { C } from "../constants";
import { User, Store, MapPin, ChevronRight } from "lucide-react";

// Previous version leaned on a dark hero gradient, blurred decorative
// circles, glowing gradient buttons and pill badges — a combination
// that reads as a generic landing-page template rather than something
// designed for this specific app. Rebuilt around the light theme and
// the light-tint icon-circle language the rest of the app already uses
// (category chips, StatCard's colored left border) instead of
// inventing a one-off dark/glow style just for this screen.
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
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 24px", fontFamily:"'Nunito',sans-serif" }}>

      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ width:52, height:52, borderRadius:16, background:`linear-gradient(135deg,${C.pri},#C0304A)`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
          <MapPin size={26} color="#fff" strokeWidth={2} />
        </div>
        <h1 style={{ fontSize:26, fontWeight:900, color:C.text, letterSpacing:-0.5, marginBottom:4 }}>Sloty</h1>
        <p style={{ fontSize:13, color:C.muted, fontWeight:600 }}>Skip the wait. Book your slot.</p>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:14, width:"100%", maxWidth:340 }}>
        {roles.map(({ role, Icon, label, sub, color }) => (
          <button
            key={role}
            onClick={() => navigate(`/auth/${role}`)}
            style={{
              padding:"18px 20px", background:C.card, border:"1.5px solid #E8ECF5", borderLeft:`4px solid ${color}`,
              borderRadius:16, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex",
              alignItems:"center", gap:14, textAlign:"left", boxShadow:"0 2px 10px rgba(26,26,46,0.05)",
              transition:"transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(26,26,46,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(26,26,46,0.05)"; }}
          >
            <div style={{ width:46, height:46, borderRadius:14, background:color+"15", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon size={22} color={color} strokeWidth={1.8} />
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:15, fontWeight:900, color:C.text, marginBottom:2 }}>{label}</p>
              <p style={{ fontSize:12, color:C.muted, fontWeight:600 }}>{sub}</p>
            </div>
            <ChevronRight size={18} color={C.muted} />
          </button>
        ))}
      </div>

      <div style={{ marginTop:36, textAlign:"center" }}>
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
  );
}
