import { useState, useEffect } from "react";
import { Gift, Copy, Share2, CheckCircle, Users, IndianRupee, Tag } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";

/**
 * Referral & Wallet screen — shown when customer taps "Refer & Earn"
 * in their Profile tab. Shows their unique code, wallet balance,
 * how many friends they've referred, and an option to apply a code
 * they received from someone else.
 */
export default function ReferralScreen({ onBack }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [applyCode,  setApplyCode]  = useState("");
  const [applying,   setApplying]   = useState(false);
  const [applyMsg,   setApplyMsg]   = useState(null); // { type:"success"|"error", text }
  const [copied,     setCopied]     = useState(false);
  const [actionErr,  setActionErr]  = useState(""); // feedback for copy/share failures

  useEffect(() => {
    api("GET", "/referral/my")
      .then(res => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Copies text to the clipboard, with a manual-select fallback for
  // when navigator.clipboard isn't available (older browsers, some
  // in-app browser contexts, or missing clipboard permission) — those
  // cases previously failed completely silently with no feedback at all.
  const copyToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        // fall through to the manual-select fallback below
      }
    }
    // Fallback: create a temporary, visually-hidden textarea, select
    // its content, and use the older execCommand copy API — works in
    // far more contexts than the modern Clipboard API alone.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch (e) {
      return false;
    }
  };

  const copyCode = async () => {
    setActionErr("");
    const ok = await copyToClipboard(data.referralCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setActionErr(`Couldn't copy automatically — your code is ${data.referralCode}`);
    }
  };

  const shareCode = async () => {
    setActionErr("");
    const text = data?.programEnabled
      ? `Join Sloty — India's smartest slot booking app! Skip the queue at salons, clinics, mechanics & more. Use my referral code ${data.referralCode} to get ₹50 free credit when you sign up! Download: https://sloty.app`
      : `Join Sloty — India's smartest slot booking app! Skip the queue at salons, clinics, mechanics & more. Use my referral code ${data.referralCode} when you sign up! Download: https://sloty.app`;
    if (navigator.share) {
      try {
        await navigator.share({ title:"Join Sloty", text });
      } catch (e) {
        // AbortError just means the user closed the share sheet without
        // picking anything — that's a normal cancellation, not a bug,
        // so it stays silent. Any OTHER error falls back to copying the
        // message instead of failing with zero feedback.
        if (e.name !== "AbortError") {
          const ok = await copyToClipboard(text);
          setActionErr(ok ? "Sharing isn't available here — copied the message instead!" : "Couldn't share or copy. Please try again.");
          if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
        }
      }
    } else {
      const ok = await copyToClipboard(text);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setActionErr("Couldn't share or copy automatically. Please try again.");
      }
    }
  };

  const applyReferral = async () => {
    if (!applyCode.trim()) return;
    setApplying(true); setApplyMsg(null);
    try {
      const res = await api("POST", "/referral/apply", { code: applyCode.trim().toUpperCase() });
      setApplyMsg({ type:"success", text: res.message });
      setData(prev => ({ ...prev, walletBalance: res.walletBalance }));
      setApplyCode("");
    } catch (e) {
      setApplyMsg({ type:"error", text: e.message });
    } finally { setApplying(false); }
  };

  if (loading) return (
    <div style={{ textAlign:"center", padding:"60px 0" }}>
      <div style={{ width:32, height:32, border:`3px solid ${C.pri}22`, borderTop:`3px solid ${C.pri}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />
    </div>
  );

  return (
    <div style={{ fontFamily:"'Nunito',sans-serif" }}>

      {/* Wallet balance banner */}
      <div style={{ background:`linear-gradient(100deg,${C.pri},#DB2777)`, borderRadius:20, padding:"20px 20px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ color:"rgba(255,255,255,0.75)", fontSize:12, fontWeight:700 }}>SLOTY WALLET</p>
          <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
            <IndianRupee size={22} color="#fff" strokeWidth={2.5} />
            <span style={{ color:"#fff", fontSize:36, fontWeight:900, lineHeight:1 }}>{data?.walletBalance ?? 0}</span>
          </div>
          <p style={{ color:"rgba(255,255,255,0.6)", fontSize:11, marginTop:4 }}>Apply at checkout to save on bookings</p>
        </div>
        <div style={{ width:56, height:56, borderRadius:18, background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <IndianRupee size={26} color="#fff" />
        </div>
      </div>

      {data && !data.programEnabled && (
        <div style={{ background:C.acc+"18", border:`1.5px solid ${C.acc}44`, borderRadius:14, padding:"12px 14px", marginBottom:16 }}>
          <p style={{ fontSize:12, fontWeight:700, color:"#8A6D00", lineHeight:1.5 }}>
            Wallet bonuses are paused for now while we're just getting started — you can still share your code and build up your referral count, and we'll let you know the moment bonuses go live.
          </p>
        </div>
      )}

      {/* Referral stats */}
      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        <div style={{ flex:1, background:"#fff", borderRadius:16, padding:"14px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <Users size={20} color={C.pri} style={{ marginBottom:4 }} />
          <p style={{ fontSize:22, fontWeight:900, color:C.text }}>{data?.referralCount ?? 0}</p>
          <p style={{ fontSize:11, color:C.muted, fontWeight:700 }}>Friends Referred</p>
        </div>
        <div style={{ flex:1, background:"#fff", borderRadius:16, padding:"14px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <Gift size={20} color={C.green} style={{ marginBottom:4 }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:2 }}>
            <IndianRupee size={14} color={C.text} strokeWidth={2.5} />
            <p style={{ fontSize:22, fontWeight:900, color:C.text }}>{data?.programEnabled ? (data?.referralCount ?? 0) * 50 : 0}</p>
          </div>
          <p style={{ fontSize:11, color:C.muted, fontWeight:700 }}>Total Earned</p>
        </div>
      </div>

      {/* Your referral code */}
      <div style={{ background:"#fff", borderRadius:20, padding:"18px 16px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <p style={{ fontSize:13, fontWeight:900, color:C.text, marginBottom:4 }}>Your Referral Code</p>
        <p style={{ fontSize:11, color:C.muted, marginBottom:14 }}>{data?.programEnabled ? <>Share this code — you both get <strong>₹50 credit</strong> when they sign up!</> : "Share this code with friends and family"}</p>

        <div style={{ background:C.pri+"10", border:`2px dashed ${C.pri}44`, borderRadius:14, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:24, fontWeight:900, color:C.pri, letterSpacing:4 }}>{data?.referralCode}</span>
          <button onClick={copyCode} style={{ background:copied?C.green:C.pri, border:"none", borderRadius:10, padding:"8px 14px", color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:6, transition:"background 0.2s" }}>
            {copied ? <><CheckCircle size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>

        <button onClick={shareCode} style={{ width:"100%", padding:"13px", background:`linear-gradient(100deg,${C.pri},#DB2777)`, border:"none", borderRadius:14, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Share2 size={16} /> Share with Friends
        </button>
        {actionErr && (
          <p style={{ marginTop:10, fontSize:12, fontWeight:700, color:C.acc, textAlign:"center" }}>{actionErr}</p>
        )}
      </div>

      {/* Apply a referral code */}
      <div style={{ background:"#fff", borderRadius:20, padding:"18px 16px", marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <p style={{ fontSize:13, fontWeight:900, color:C.text, marginBottom:4 }}>Have a Friend's Code?</p>
        <p style={{ fontSize:11, color:C.muted, marginBottom:14 }}>{data?.programEnabled ? <>Enter their referral code to get <strong>₹50 credit</strong> added to your wallet</> : "Enter a friend's referral code here"}</p>

        <div style={{ display:"flex", gap:8 }}>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, border:"2px solid #E8ECF5", borderRadius:12, padding:"11px 14px" }}>
            <Tag size={15} color={C.muted} />
            <input value={applyCode} onChange={e => setApplyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8))} placeholder="e.g. SITA1234" style={{ flex:1, border:"none", outline:"none", fontSize:14, fontWeight:800, letterSpacing:2, fontFamily:"'Nunito',sans-serif", color:C.text }} />
          </div>
          <button onClick={applyReferral} disabled={applying||!applyCode.trim()} style={{ padding:"11px 18px", background:applying||!applyCode.trim()?"#E0E4EF":C.pri, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:13, cursor:applying||!applyCode.trim()?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif" }}>
            {applying ? "..." : "Apply"}
          </button>
        </div>

        {applyMsg && (
          <div style={{ marginTop:10, padding:"10px 14px", borderRadius:10, background:applyMsg.type==="success"?C.green+"15":C.red+"15", display:"flex", gap:8, alignItems:"center" }}>
            {applyMsg.type==="success" ? <CheckCircle size={14} color={C.green} /> : null}
            <p style={{ fontSize:12, fontWeight:700, color:applyMsg.type==="success"?C.green:C.red }}>{applyMsg.text}</p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{ background:"#fff", borderRadius:20, padding:"18px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <p style={{ fontSize:13, fontWeight:900, color:C.text, marginBottom:14 }}>How It Works</p>
        {[
          { n:1, text:"Share your referral code with friends & family" },
          { n:2, text:"They sign up on Sloty and enter your code" },
          { n:3, text: data?.programEnabled ? "You both get ₹50 credit instantly in your wallets" : "Wallet bonuses aren't active yet — coming soon!" },
          { n:4, text:"Use your credit to pay less on any booking" },
        ].map(step => (
          <div key={step.n} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:12 }}>
            <div style={{ width:26, height:26, borderRadius:8, background:C.pri, color:"#fff", fontWeight:900, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{step.n}</div>
            <p style={{ fontSize:13, color:C.muted, fontWeight:700, paddingTop:3 }}>{step.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}