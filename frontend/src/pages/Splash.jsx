import { useNavigate } from "react-router-dom";
import { C } from "../constants";
import { User, Store, MapPin, Zap, Clock, ChevronRight } from "lucide-react";

export default function Splash() {
  const navigate = useNavigate();

  // Admin intentionally has no card here — accessed only via a direct
  // URL (/auth/admin), never shown publicly. Customer and Owner now
  // get EQUALLY strong, vibrant treatment — previously Owner was a
  // dim, semi-transparent card next to Customer's bold gradient,
  // which unintentionally made Owner feel like an afterthought rather
  // than an equally attractive path.
  const roles = [
    {
      role:"customer",
      Icon:User,
      label:"I'm a Customer",
      sub:"Book slots near you, skip the wait",
      bg:`linear-gradient(100deg,${C.pri},#DB2777)`,
      shadow:`0 10px 30px ${C.pri}55`,
    },
    {
      role:"owner",
      Icon:Store,
      label:"I'm a Store Owner",
      sub:"Manage bookings, grow your business",
      bg:"linear-gradient(100deg,#00C9A7,#00A887)",
      shadow:"0 10px 30px rgba(0,201,167,0.35)",
    },
  ];

  const badges = [
    { Icon:MapPin, label:"Made for India"   },
    { Icon:Zap,    label:"Real-time Queue"  },
    { Icon:Clock,  label:"Skip the Wait"    },
  ];

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg,${C.sec} 0%,#2D1B4E 100%)`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", padding:"14vh 28px 28px", fontFamily:"'Nunito',sans-serif", position:"relative", overflow:"hidden" }}>

      {/* Decorative background circles */}
      <div style={{ position:"absolute", top:-60, right:-60, width:220, height:220, borderRadius:"50%", background:"rgba(255,94,125,0.08)" }} />
      <div style={{ position:"absolute", bottom:-40, left:-40, width:160, height:160, borderRadius:"50%", background:"rgba(162,155,254,0.06)" }} />
      <div style={{ position:"absolute", top:"35%", left:-20, width:80,  height:80,  borderRadius:"50%", background:"rgba(255,255,255,0.03)" }} />

      {/* Logo — tightened vertical footprint so the role buttons (the
          actual thing a user needs to act on) appear sooner, without
          needing to scroll past excess branding first. */}
      <div style={{ textAlign:"center", marginBottom:26 }}>
        <div style={{ width:58, height:58, borderRadius:20, background:`linear-gradient(135deg,${C.pri},#C0304A)`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", boxShadow:`0 10px 32px ${C.pri}44` }}>
          <MapPin size={28} color="#fff" strokeWidth={2} />
        </div>
        <h1 style={{ fontSize:32, fontWeight:900, color:"#fff", letterSpacing:-1, marginBottom:4 }}>Sloty</h1>
        <p style={{ fontSize:13, color:"rgba(255,255,255,0.55)", marginBottom:16 }}>Skip the wait. Book your slot.</p>

        {/* Badges — bumped up opacity/size so these trust signals
            actually register instead of nearly disappearing. */}
        <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
          {badges.map(({ Icon, label }) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(255,255,255,0.1)", borderRadius:20, padding:"6px 12px", border:"1px solid rgba(255,255,255,0.12)" }}>
              <Icon size={12} color="rgba(255,255,255,0.75)" />
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.75)", fontWeight:700 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role buttons — both now equally bold and vibrant, so Customer
          and Store Owner feel like two equally attractive, legitimate
          paths rather than one primary + one secondary option. */}
      <div style={{ display:"flex", flexDirection:"column", gap:14, width:"100%", maxWidth:340 }}>
        {roles.map(({ role, Icon, label, sub, bg, shadow }) => (
          <button
            key={role}
            onClick={() => navigate(`/auth/${role}`)}
            style={{
              padding:"20px 22px", background:bg, border:"none", borderRadius:20,
              cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex",
              alignItems:"center", gap:16, textAlign:"left", boxShadow:shadow,
              transition:"transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div style={{ width:48, height:48, borderRadius:16, background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon size={24} color="#fff" strokeWidth={1.8} />
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:16, fontWeight:900, color:"#fff", marginBottom:2 }}>{label}</p>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontWeight:600 }}>{sub}</p>
            </div>
            <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
          </button>
        ))}
      </div>

      {/* Footer — fills the space below the role buttons with something
          genuinely useful rather than empty decoration: links to the
          Privacy Policy and Terms pages, which already exist and are
          routed but weren't linked from anywhere visible until now. */}
      <div style={{ marginTop:40, textAlign:"center" }}>
        <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:8 }}>
          By continuing, you agree to our
        </p>
        <div style={{ display:"flex", gap:6, justifyContent:"center", alignItems:"center", fontSize:11, fontWeight:700 }}>
          <span onClick={() => navigate("/terms")} style={{ color:"rgba(255,255,255,0.6)", cursor:"pointer", textDecoration:"underline" }}>Terms of Service</span>
          <span style={{ color:"rgba(255,255,255,0.3)" }}>&</span>
          <span onClick={() => navigate("/privacy")} style={{ color:"rgba(255,255,255,0.6)", cursor:"pointer", textDecoration:"underline" }}>Privacy Policy</span>
        </div>
      </div>

    </div>
  );
}