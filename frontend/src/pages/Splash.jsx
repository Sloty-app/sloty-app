import { useNavigate } from "react-router-dom";
import { C } from "../constants";
import { User, Store, MapPin, ChevronRight, Zap, Clock } from "lucide-react";

// Second pass at this screen. The flat light version fixed the color
// clash but landed too plain. This keeps the light theme (still
// cohesive with the rest of the app, still no harsh dark/glow) but
// adds real visual richness: a soft pastel gradient-mesh backdrop
// instead of flat gray, a glowing hero mark, and role cards with a
// gentle tinted-gradient fill (not stark white, not a loud solid
// gradient either) plus a soft colored shadow that only appears on
// hover — depth without going back to the "generic template" look.
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
      dark:"#6D28D9",
    },
    {
      role:"owner",
      Icon:Store,
      label:"I'm a Store Owner",
      sub:"Manage bookings, grow your business",
      color:C.blue,
      dark:"#1D6FCC",
    },
  ];

  const trust = [
    { Icon:MapPin, label:"Made for India"  },
    { Icon:Zap,    label:"Real-time queue" },
    { Icon:Clock,  label:"Zero wait time"  },
  ];

  return (
    <div style={{
      minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"32px 24px", fontFamily:"'Nunito',sans-serif", position:"relative", overflow:"hidden",
      background:`radial-gradient(circle at 15% -10%, #F0EBFF 0%, transparent 45%), radial-gradient(circle at 100% 10%, #E8F4FF 0%, transparent 40%), radial-gradient(circle at 0% 100%, #FFF0F6 0%, transparent 40%), ${C.bg}`,
    }}>

      <div style={{ textAlign:"center", marginBottom:34, position:"relative", zIndex:1 }}>
        <div style={{ width:64, height:64, borderRadius:20, background:`linear-gradient(135deg,${C.pri},#DB2777)`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", boxShadow:`0 16px 32px ${C.pri}38` }}>
          <MapPin size={30} color="#fff" strokeWidth={2} />
        </div>
        <h1 style={{ fontSize:30, fontWeight:900, color:C.text, letterSpacing:-0.5, marginBottom:6 }}>Sloty</h1>
        <p style={{ fontSize:13.5, color:C.muted, fontWeight:600, marginBottom:18 }}>Skip the wait. Book your slot.</p>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14 }}>
          {trust.map(({ Icon, label }, i) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:14 }}>
              {i > 0 && <div style={{ width:3, height:3, borderRadius:"50%", background:"#C5CAD8" }} />}
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <Icon size={12} color={C.pri} />
                <span style={{ fontSize:11.5, color:C.muted, fontWeight:700 }}>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:16, width:"100%", maxWidth:340, position:"relative", zIndex:1 }}>
        {roles.map(({ role, Icon, label, sub, color, dark }) => (
          <button
            key={role}
            onClick={() => navigate(`/auth/${role}`)}
            style={{
              padding:"22px 20px", background:`linear-gradient(135deg, ${color}10, ${color}03 60%)`,
              border:`1.5px solid ${color}28`, borderRadius:20, cursor:"pointer",
              fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:16, textAlign:"left",
              boxShadow:"0 2px 12px rgba(26,26,46,0.04)",
              transition:"transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 14px 28px ${color}30`; e.currentTarget.style.borderColor = color+"55"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(26,26,46,0.04)"; e.currentTarget.style.borderColor = color+"28"; }}
          >
            <div style={{ width:52, height:52, borderRadius:16, background:`linear-gradient(135deg, ${color}, ${dark})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 8px 18px ${color}44` }}>
              <Icon size={24} color="#fff" strokeWidth={1.8} />
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:2 }}>{label}</p>
              <p style={{ fontSize:12.5, color:C.muted, fontWeight:600 }}>{sub}</p>
            </div>
            <ChevronRight size={19} color={color} />
          </button>
        ))}
      </div>

      <div style={{ marginTop:34, textAlign:"center", position:"relative", zIndex:1 }}>
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
