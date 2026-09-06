import { useNavigate } from "react-router-dom";
import { C } from "../constants";
import { User, Store, MapPin, ChevronRight, Zap, Clock } from "lucide-react";

// Third pass. The soft pastel-mesh background was so low-saturation
// that the muted gray body text had almost nothing to contrast
// against and read as faded. Switched to an actual solid brand-color
// backdrop (the app's own violet, matching CustomerApp/Auth's role
// gradient) with crisp white text, and white role cards floating on
// top of it — colored backdrop + white content cards is a strong,
// classic pairing that gives real contrast in both directions, rather
// than everything sitting at the same low-saturation, low-contrast
// level.
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
      padding:"32px 24px", fontFamily:"'Nunito',sans-serif",
      background:`linear-gradient(165deg, ${C.pri} 0%, #6D28D9 55%, #4C1D95 100%)`,
    }}>

      <div style={{ textAlign:"center", marginBottom:34 }}>
        <div style={{ width:64, height:64, borderRadius:20, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", boxShadow:"0 12px 28px rgba(0,0,0,0.18)" }}>
          <MapPin size={30} color={C.pri} strokeWidth={2} />
        </div>
        <h1 style={{ fontSize:30, fontWeight:900, color:"#fff", letterSpacing:-0.5, marginBottom:6 }}>Sloty</h1>
        <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.85)", fontWeight:700, marginBottom:18 }}>Skip the wait. Book your slot.</p>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14 }}>
          {trust.map(({ Icon, label }, i) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:14 }}>
              {i > 0 && <div style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,0.35)" }} />}
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <Icon size={12} color="rgba(255,255,255,0.85)" />
                <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.85)", fontWeight:700 }}>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:16, width:"100%", maxWidth:340 }}>
        {roles.map(({ role, Icon, label, sub, color, dark }) => (
          <button
            key={role}
            onClick={() => navigate(`/auth/${role}`)}
            style={{
              padding:"22px 20px", background:"#fff", border:"none", borderRadius:20, cursor:"pointer",
              fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:16, textAlign:"left",
              boxShadow:"0 12px 30px rgba(20,10,50,0.22)",
              transition:"transform 0.18s ease, box-shadow 0.18s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 18px 38px rgba(20,10,50,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(20,10,50,0.22)"; }}
          >
            <div style={{ width:52, height:52, borderRadius:16, background:`linear-gradient(135deg, ${color}, ${dark})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
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

      <div style={{ marginTop:34, textAlign:"center" }}>
        <p style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginBottom:6 }}>
          By continuing, you agree to our
        </p>
        <div style={{ display:"flex", gap:6, justifyContent:"center", alignItems:"center", fontSize:11, fontWeight:700 }}>
          <span onClick={() => navigate("/terms")} style={{ color:"rgba(255,255,255,0.85)", cursor:"pointer", textDecoration:"underline" }}>Terms of Service</span>
          <span style={{ color:"rgba(255,255,255,0.4)" }}>&</span>
          <span onClick={() => navigate("/privacy")} style={{ color:"rgba(255,255,255,0.85)", cursor:"pointer", textDecoration:"underline" }}>Privacy Policy</span>
        </div>
      </div>

    </div>
  );
}
