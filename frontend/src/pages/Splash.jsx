import { useNavigate } from "react-router-dom";
import { C } from "../constants";
import { User, Store, MapPin, ChevronRight, Zap, Clock } from "lucide-react";

// Fourth pass — asked to make this genuinely impressive rather than
// just "clean". Keeps everything that already fixed real problems
// (solid brand-violet backdrop so text has real contrast, white cards
// so their own text stays crisp) and adds the things that make a first
// screen feel premium instead of static: a slowly panning gradient and
// two drifting blurred color orbs behind the content (alive, not a
// frozen image), a staggered fade/slide entrance for the logo, title
// and both cards instead of everything popping in at once, and a
// diagonal light-sweep across each card on hover. All done with plain
// CSS keyframes/backdrop-filter — no new dependency.
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
    <div className="splash-root" style={{
      minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"32px 24px", fontFamily:"'Nunito',sans-serif", position:"relative", overflow:"hidden",
    }}>
      <style>{`
        .splash-root {
          background: linear-gradient(165deg, ${C.pri} 0%, #6D28D9 45%, #4C1D95 75%, #7C1D6E 100%);
          background-size: 250% 250%;
          animation: splashPan 14s ease-in-out infinite alternate;
        }
        @keyframes splashPan {
          0%   { background-position: 0% 20%; }
          100% { background-position: 100% 80%; }
        }
        .splash-orb {
          position: absolute; border-radius: 50%; filter: blur(50px);
          pointer-events: none;
        }
        .splash-orb--1 {
          width: 260px; height: 260px; top: -80px; right: -60px;
          background: rgba(236,72,153,0.35);
          animation: splashFloat1 9s ease-in-out infinite alternate;
        }
        .splash-orb--2 {
          width: 220px; height: 220px; bottom: -60px; left: -60px;
          background: rgba(59,158,255,0.25);
          animation: splashFloat2 11s ease-in-out infinite alternate;
        }
        @keyframes splashFloat1 {
          0%   { transform: translate(0,0) scale(1); }
          100% { transform: translate(-24px,28px) scale(1.15); }
        }
        @keyframes splashFloat2 {
          0%   { transform: translate(0,0) scale(1); }
          100% { transform: translate(20px,-20px) scale(1.1); }
        }
        .splash-in {
          opacity: 0;
          animation: splashInUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        @keyframes splashInUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .splash-logo-bob {
          animation: splashBob 3.2s ease-in-out 0.9s infinite;
        }
        @keyframes splashBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .splash-card { position: relative; overflow: hidden; }
        .splash-card::after {
          content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent);
          transform: skewX(-20deg);
          transition: left 0.6s ease;
        }
        .splash-card:hover::after { left: 130%; }
      `}</style>

      <div className="splash-orb splash-orb--1" />
      <div className="splash-orb splash-orb--2" />

      <div style={{ textAlign:"center", marginBottom:34, position:"relative", zIndex:1 }}>
        <div className="splash-in" style={{ marginBottom:16 }}>
          <div className="splash-logo-bob" style={{ width:64, height:64, borderRadius:20, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", boxShadow:"0 12px 28px rgba(0,0,0,0.2)" }}>
            <MapPin size={30} color={C.pri} strokeWidth={2} />
          </div>
        </div>
        <h1 className="splash-in" style={{ animationDelay:"0.1s", fontSize:32, fontWeight:900, color:"#fff", letterSpacing:-0.5, marginBottom:6 }}>Sloty</h1>
        <p className="splash-in" style={{ animationDelay:"0.18s", fontSize:13.5, color:"rgba(255,255,255,0.85)", fontWeight:700, marginBottom:18 }}>Skip the wait. Book your slot.</p>

        <div className="splash-in" style={{ animationDelay:"0.26s", display:"flex", alignItems:"center", justifyContent:"center", gap:14 }}>
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

      <div style={{ display:"flex", flexDirection:"column", gap:16, width:"100%", maxWidth:340, position:"relative", zIndex:1 }}>
        {roles.map(({ role, Icon, label, sub, color, dark }, i) => (
          <button
            key={role}
            className="splash-in splash-card"
            style={{
              animationDelay:`${0.34 + i*0.1}s`,
              padding:"22px 20px", background:"#fff", border:"none", borderRadius:20, cursor:"pointer",
              fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:16, textAlign:"left",
              boxShadow:"0 12px 30px rgba(20,10,50,0.22)",
              transition:"transform 0.18s ease, box-shadow 0.18s ease",
            }}
            onClick={() => navigate(`/auth/${role}`)}
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

      <div className="splash-in" style={{ animationDelay:"0.56s", marginTop:34, textAlign:"center", position:"relative", zIndex:1 }}>
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
