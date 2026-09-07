import { useNavigate } from "react-router-dom";
import { C } from "../constants";
import { Scissors, Stethoscope, Car, TrendingUp, Wallet, ChevronRight } from "lucide-react";

// Back to the illustrated-card version (the one direction that got a
// genuinely positive reaction), refined rather than replaced again:
// tightened the bubble color palette down to each card's own hue
// family instead of four unrelated pastels scattered across one card,
// and cleaned up spacing/sizing so the composition breathes a bit
// more. Kept the geometric phone/storefront illustrations (safer than
// freehand figures) and the real service-category icons.
function CustomerScene() {
  return (
    <svg viewBox="0 0 140 120" width="100%" height="100%" style={{ overflow:"visible" }}>
      <ellipse cx="70" cy="106" rx="46" ry="8" fill={C.pri} opacity="0.08" />
      <g transform="rotate(-9 70 58)">
        <rect x="35" y="8" width="70" height="106" rx="16" fill="#fff" stroke={C.pri} strokeWidth="3" />
        <rect x="44" y="20" width="52" height="14" rx="5" fill="#F3EFFF" />
        <rect x="44" y="40" width="52" height="38" rx="9" fill="#F3EFFF" />
        <circle cx="55" cy="52" r="6.5" fill={C.pri} />
        <rect x="66" y="47" width="26" height="5" rx="2.5" fill="#C9B8FF" />
        <rect x="66" y="57" width="18" height="5" rx="2.5" fill="#E4D9FF" />
        <rect x="44" y="86" width="52" height="13" rx="6.5" fill={C.pri} />
      </g>
    </svg>
  );
}

function OwnerScene() {
  return (
    <svg viewBox="0 0 140 120" width="100%" height="100%" style={{ overflow:"visible" }}>
      <ellipse cx="70" cy="108" rx="46" ry="8" fill={C.blue} opacity="0.08" />
      <path d="M28 52 L42 26 L98 26 L112 52 Z" fill={C.blue} />
      <rect x="33" y="52" width="74" height="54" rx="6" fill="#fff" stroke={C.blue} strokeWidth="3" />
      <rect x="42" y="60" width="24" height="20" rx="4" fill="#EAF4FF" />
      <path d="M46 74 L52 66 L57 70 L63 61" stroke={C.blue} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="60" y="86" width="20" height="20" rx="3" fill="#EAF4FF" stroke={C.blue} strokeWidth="2" />
      <circle cx="76" cy="96" r="1.6" fill={C.blue} />
    </svg>
  );
}

const Bubble = ({ Icon, color, bg, style }) => (
  <div style={{ position:"absolute", width:30, height:30, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 10px rgba(20,10,50,0.1)", ...style }}>
    <Icon size={14} color={color} strokeWidth={2} />
  </div>
);

export default function Splash() {
  const navigate = useNavigate();

  // Admin intentionally has no card here — accessed only via a direct
  // URL (/auth/admin), never shown publicly.
  const roles = [
    {
      role:"customer", label:"Customer", color:C.pri, bg:"#F3EFFF",
      sub:"Find and book the best services near you, without the wait.",
      Scene:CustomerScene,
      // Same violet family throughout instead of four unrelated
      // pastel hues — reads as one coordinated card, not a grab-bag.
      bubbles:[
        { Icon:Scissors,     top:-10, left:80,  bg:"#F3EFFF" },
        { Icon:Stethoscope,  top:40,  left:-14, bg:"#EDE7FE" },
        { Icon:Car,          top:82,  left:108, bg:"#F5F2FF" },
      ],
    },
    {
      role:"owner", label:"Store Owner", color:C.blue, bg:"#EAF4FF",
      sub:"Manage your bookings, your queue and grow your business.",
      Scene:OwnerScene,
      bubbles:[
        { Icon:TrendingUp, top:-8, left:82,  bg:"#EAF4FF" },
        { Icon:Wallet,     top:72, left:110, bg:"#E0EFFF" },
      ],
    },
  ];

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"#fff", fontFamily:"'Nunito',sans-serif", position:"relative", overflow:"hidden" }}>

      <div style={{ padding:"40px 22px 8px", position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:8 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:`linear-gradient(135deg,${C.pri},#DB2777)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.6 8 12 8 12s8-6.4 8-12c0-4.4-3.6-8-8-8Z" fill="#fff" /><circle cx="12" cy="10" r="3" fill={C.pri} /></svg>
          </div>
          <h1 style={{ fontSize:27, fontWeight:900, color:C.text, letterSpacing:-0.5 }}>Sloty</h1>
        </div>
        <p style={{ fontSize:12.5, color:C.muted, fontWeight:700, textAlign:"center" }}>Skip the wait. Book your slot.</p>

        {/* Handwritten-style accent note — approximated with an
            italic, slightly rotated caption since the app doesn't load
            a script font elsewhere and adding one just for this one
            line isn't worth a new font dependency. */}
        <div style={{ position:"absolute", top:38, right:20, transform:"rotate(-6deg)", textAlign:"center" }}>
          <p style={{ fontSize:11, fontStyle:"italic", fontWeight:800, color:C.pri }}>Made for you</p>
          <div style={{ height:2, width:"70%", margin:"1px auto 0", background:C.pri, opacity:0.4, borderRadius:2 }} />
        </div>
      </div>

      <div style={{ textAlign:"center", padding:"18px 24px 26px" }}>
        <h2 style={{ fontSize:22, fontWeight:900, color:C.text, marginBottom:5 }}>Welcome to <span style={{ color:C.pri }}>Sloty</span></h2>
        <p style={{ fontSize:13, color:C.muted, fontWeight:600 }}>Choose how you'd like to continue</p>
      </div>

      <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:20 }}>
        {roles.map(({ role, label, color, bg, sub, Scene, bubbles }) => (
          <button
            key={role}
            onClick={() => navigate(`/auth/${role}`)}
            style={{
              position:"relative", background:bg, border:"none", borderRadius:24, padding:"24px 20px",
              cursor:"pointer", fontFamily:"'Nunito',sans-serif", textAlign:"left", overflow:"visible",
              display:"flex", alignItems:"center", gap:12,
              boxShadow:"0 4px 16px rgba(20,10,50,0.06)", transition:"transform 0.18s ease, box-shadow 0.18s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 14px 28px ${color}30`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(20,10,50,0.06)"; }}
          >
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:13.5, fontWeight:800, color:C.text, marginBottom:0 }}>I'm a</p>
              <p style={{ fontSize:22, fontWeight:900, color, marginBottom:9, lineHeight:1.05 }}>{label}</p>
              <p style={{ fontSize:12.5, color:C.muted, fontWeight:600, lineHeight:1.45 }}>{sub}</p>
            </div>

            <div style={{ position:"relative", width:112, height:104, flexShrink:0 }}>
              <Scene />
              {bubbles.map((b,i) => <Bubble key={i} Icon={b.Icon} color={color} bg={b.bg} style={{ top:b.top, left:b.left }} />)}
            </div>

            <div style={{ position:"absolute", right:18, bottom:-14, width:38, height:38, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 6px 16px ${color}55` }}>
              <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop:40, textAlign:"center", padding:"0 24px" }}>
        <div style={{ display:"flex", gap:6, justifyContent:"center", alignItems:"center", fontSize:11, fontWeight:700 }}>
          <span onClick={() => navigate("/terms")} style={{ color:C.muted, cursor:"pointer", textDecoration:"underline" }}>Terms of Service</span>
          <span style={{ color:"#C5CAD8" }}>&</span>
          <span onClick={() => navigate("/privacy")} style={{ color:C.muted, cursor:"pointer", textDecoration:"underline" }}>Privacy Policy</span>
        </div>
      </div>

      {/* flex:1 on the lavender section (not just this wrapper) is what
          actually closes the gap — on a device where the content above
          is shorter than the real viewport height, this stretches down
          to the bottom of the screen instead of stopping at its own
          content height and leaving the root's white background
          exposed below it, which is exactly what showed up as a blank
          white gap on a real phone. */}
      <div style={{ position:"relative", marginTop:28, flex:1, display:"flex", flexDirection:"column" }}>
        <svg viewBox="0 0 400 60" width="100%" height="60" preserveAspectRatio="none" style={{ display:"block", flexShrink:0 }}>
          <path d="M0,30 C100,60 300,0 400,30 L400,60 L0,60 Z" fill="#F3EFFF" />
        </svg>
        <div style={{ background:"#F3EFFF", flex:1, padding:"0 24px 28px", display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
          <p style={{ fontSize:12.5, fontStyle:"italic", fontWeight:800, color:C.pri }}>Same great service, zero wait.</p>
        </div>
      </div>

    </div>
  );
}
