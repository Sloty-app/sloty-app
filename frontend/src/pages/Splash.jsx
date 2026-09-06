import { useNavigate } from "react-router-dom";
import { C } from "../constants";
import { MapPin, User, Store, ChevronRight } from "lucide-react";

// Sixth pass. Every illustrated/animated/dark-hero idea tried so far
// invented its own one-off visual language for this single screen.
// The actual fix: this is the screen right before Auth.jsx, and
// Auth.jsx already has an established shell — a gradient header panel
// (icon badge + "SLOTY" accent-dot label + title + tagline, with two
// soft translucent decorative circles) that overlaps into a light
// body below via a negative-margin rounded-top card. Splash now uses
// that exact same shell instead of a different one, so the app feels
// like one continuous flow from the very first tap instead of
// switching visual languages between screen 1 and screen 2.
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

      <div style={{ background:`linear-gradient(160deg,${C.pri} 0%,#DB2777 100%)`, padding:"56px 24px 56px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }} />
        <div style={{ position:"absolute", bottom:-20, left:-30, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />

        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:60, height:60, borderRadius:20, background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(10px)" }}>
            <MapPin size={28} color="#fff" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.acc }} />
              <span style={{ fontSize:11, color:C.acc, fontWeight:800, letterSpacing:2 }}>WELCOME TO</span>
            </div>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", lineHeight:1.1 }}>Sloty</h1>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.65)", marginTop:4 }}>Skip the wait. Book your slot.</p>
          </div>
        </div>
      </div>

      <div style={{ flex:1, background:C.bg, marginTop:-24, borderTopLeftRadius:28, borderTopRightRadius:28, padding:"24px 20px 40px", overflowY:"auto" }}>

        <p style={{ fontSize:13, color:C.muted, fontWeight:700, marginBottom:14 }}>Choose how you'd like to continue</p>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {roles.map(({ role, Icon, label, sub, color }) => (
            <button
              key={role}
              onClick={() => navigate(`/auth/${role}`)}
              style={{
                padding:"18px 20px", background:"#fff", border:"none", borderRadius:20, cursor:"pointer",
                fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:14, textAlign:"left",
                boxShadow:"0 4px 24px rgba(0,0,0,0.06)", transition:"transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06)"; }}
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
  );
}
