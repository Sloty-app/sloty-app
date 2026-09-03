import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { C } from "../constants";
import { MapPicker, LocationDetector } from "../components/UI";
import { auth } from "../firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import {
  ArrowLeft, Mail, Lock, User, Phone, MapPin,
  Eye, EyeOff, LogIn, UserPlus, Store, Shield,
  CheckCircle, AlertCircle, Zap, ShieldCheck, RotateCcw
} from "lucide-react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

/* ── Role config ── */
const ROLES = {
  customer: {
    icon:     User,
    label:    "Customer",
    tagline:  "Skip the queue. Book your slot.",
    gradient: `linear-gradient(160deg,${C.pri} 0%,#C0304A 100%)`,
    accent:   C.pri,
  },
  owner: {
    icon:     Store,
    label:    "Store Owner",
    tagline:  "Manage your business effortlessly.",
    gradient: `linear-gradient(160deg,#1A1A2E 0%,#2D1B4E 100%)`,
    accent:   "#A29BFE",
  },
  admin: {
    icon:     Shield,
    label:    "Admin",
    tagline:  "Full control at your fingertips.",
    gradient: `linear-gradient(160deg,#2D1B4E 0%,#4A1D8C 100%)`,
    accent:   "#FFD23F",
  },
};

/* ── Phone number input — a plain full-width box with just a phone
   icon read as bare/stretched, and gave no visual sense of the fixed
   +91 country code baked into every submission. A distinct "+91"
   segment glued to the number field (the pattern every Indian phone-
   login screen uses) makes it read as a deliberately designed control
   instead of a generic oversized text box. */
function PhoneInput({ value, onChange, color=C.pri }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:6 }}>MOBILE NUMBER</label>
      <div style={{ display:"flex", alignItems:"stretch", border:`2px solid ${focused?color:"#E8ECF5"}`, borderRadius:14, background:focused?"#FAFBFF":"#F8FAFF", transition:"all 0.2s", overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", padding:"0 14px", borderRight:`2px solid ${focused?color+"33":"#E8ECF5"}`, flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:800, color:C.text }}>+91</span>
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={onChange}
          placeholder="10-digit mobile number"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex:1, minWidth:0, padding:"14px 14px 14px 10px", border:"none", background:"transparent", fontSize:15, fontWeight:700, letterSpacing:0.5, color:C.text, outline:"none", fontFamily:"'Nunito',sans-serif", boxSizing:"border-box" }}
        />
      </div>
    </div>
  );
}

/* ── OTP input — six individual digit boxes instead of one oversized
   dashed field. The real <input> stays as the single source of truth
   (autofill, paste, SMS auto-read via autoComplete="one-time-code" all
   keep working exactly as before) but sits invisibly on top of the
   boxes, which just render whatever characters are currently in value —
   the same trick behind every "6-box OTP" UI, without needing six
   separate inputs/refs/focus-management to get right. */
function OtpBoxes({ value, onChange, color=C.pri, length=6 }) {
  const inputRef = useRef(null);
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:8 }}>ENTER OTP</label>
      <div style={{ position:"relative" }} onClick={() => inputRef.current?.focus()}>
        <div style={{ display:"flex", gap:8 }}>
          {Array.from({ length }).map((_, i) => {
            const filled = value[i];
            const isNext = i === value.length;
            return (
              <div key={i} style={{
                flex:1, height:52, display:"flex", alignItems:"center", justifyContent:"center",
                border:`2px solid ${filled ? color : isNext ? color+"88" : "#E8ECF5"}`,
                borderRadius:12, fontSize:22, fontWeight:900, color:C.text,
                background: filled ? color+"0D" : "#F8FAFF",
                transition:"all 0.15s", cursor:"text",
              }}>
                {filled || ""}
              </div>
            );
          })}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={onChange}
          type="tel"
          inputMode="numeric"
          maxLength={length}
          autoComplete="one-time-code"
          autoFocus
          style={{ position:"absolute", inset:0, opacity:0, border:"none", outline:"none", fontFamily:"'Nunito',sans-serif" }}
        />
      </div>
    </div>
  );
}

/* ── Icon Input ── */
function IconInput({ icon: Icon, label, type="text", value, onChange, placeholder, color=C.pri, right, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:6 }}>{label}</label>}
      <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
        <div style={{ position:"absolute", left:14, display:"flex", alignItems:"center", pointerEvents:"none", transition:"color 0.2s" }}>
          <Icon size={16} color={focused?color:C.muted} strokeWidth={focused?2.5:1.8} />
        </div>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ width:"100%", padding:"14px 44px 14px 44px", border:`2px solid ${focused?color:"#E8ECF5"}`, borderRadius:14, fontSize:14, color:C.text, background:focused?"#FAFBFF":"#F8FAFF", outline:"none", fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", transition:"all 0.2s" }}
          {...rest}
        />
        {right && <div style={{ position:"absolute", right:14 }}>{right}</div>}
      </div>
    </div>
  );
}

/* ── Phone + OTP flow — used by both Customers and Store Owners.
   OTP is now handled entirely by Firebase Phone Auth (real SMS,
   client-side verification) rather than the app's own backend —
   the backend only gets involved AFTER Firebase has already
   confirmed the phone number, to independently verify that
   confirmation and issue Sloty's own session token. Each role's
   account is still scoped server-side by `role`, so the same phone
   number can hold a separate account for each. ── */
function GoogleSignInButton({ onSuccess, onError }) {
  const login = useGoogleLogin({ onSuccess, onError, flow:"implicit" });
  return (
    <button onClick={() => login()} style={{ width:"100%", padding:"12px 16px", background:"#fff", border:"1.5px solid #E8ECF5", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:14, fontWeight:800, color:"#3C4043", boxShadow:"0 1px 6px rgba(0,0,0,0.08)" }}>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      Continue with Google
    </button>
  );
}

function CustomerOtpAuth({ cfg, role, onSuccess }) {
  const [step,      setStep]      = useState("phone"); // "phone" | "otp" | "name"
  const [phone,     setPhone]     = useState("");
  const [otp,       setOtp]       = useState("");
  const [name,      setName]      = useState("");
  const [err,       setErr]       = useState("");
  const [loading,   setLoading]   = useState(false);
  const [cooldown,  setCooldown]  = useState(0);
  const [backendRetryNeeded, setBackendRetryNeeded] = useState(false);

  const confirmationRef = useRef(null);
  const recaptchaRef = useRef(null);
  const idTokenRef = useRef(null);

  const handleGoogleSuccess = async (tokenResponse) => {
    try {
      const accessToken = tokenResponse.access_token;
      if (!accessToken) { setErr("Google sign-in failed — no token received"); return; }
      const res = await api("POST", "/auth/google", { accessToken, role });
      onSuccess(res);
    } catch (e) { setErr(e.message || "Google sign-in failed"); }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const getRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaRef.current;
  };

  const sendOtp = async () => {
    setErr("");
    if (!/^[6-9]\d{9}$/.test(phone)) return setErr("Enter a valid 10-digit mobile number");
    setLoading(true);
    try {
      const verifier = getRecaptcha();
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, verifier);
      confirmationRef.current = result;
      setOtp("");
      setStep("otp");
      setCooldown(45);
    } catch (e) {
      console.error(e);
      setErr(e.code === "auth/too-many-requests" ? "Too many attempts — please wait a while and try again" : "Could not send OTP. Please check the number and try again.");
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (step !== "otp") return;
    if (!("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials.get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then(cred => { if (cred?.code) setOtp(cred.code); })
      .catch(() => {});
    return () => ac.abort();
  }, [step]);

  const loginToBackend = async (withName) => {
    const res = await api("POST", "/auth/firebase-login", {
      idToken: idTokenRef.current,
      role,
      name: withName || undefined,
    });
    onSuccess(res);
  };

  const verifyOtp = async () => {
    setErr(""); setBackendRetryNeeded(false);
    if (otp.length !== 6) return setErr("Enter the 6-digit OTP");
    if (!confirmationRef.current) return setErr("Session expired — please request a new OTP");
    setLoading(true);
    try {
      const result = await confirmationRef.current.confirm(otp);
      idTokenRef.current = await result.user.getIdToken();
      await loginToBackend();
    } catch (e) {
      if (e.message && /enter your name/i.test(e.message)) {
        setStep("name");
      } else if (e.code === "auth/invalid-verification-code") {
        setErr("Incorrect OTP. Please try again.");
      } else if (e.code === "auth/code-expired") {
        setErr("OTP expired. Please request a new one.");
      } else if (idTokenRef.current) {
        // Firebase already succeeded here — idTokenRef is only set
        // after confirm() succeeds — so this failure is from the
        // backend call itself (network blip, transient server error),
        // not the OTP. No need to make them re-verify from scratch;
        // the same token is still valid to retry with directly.
        setErr("Verified, but couldn't reach our server just now.");
        setBackendRetryNeeded(true);
      } else {
        setErr(e.message || "Verification failed. Please try again.");
      }
    }
    finally { setLoading(false); }
  };

  const retryBackendLogin = async () => {
    setErr(""); setLoading(true);
    try {
      await loginToBackend();
    } catch (e) {
      if (e.message && /enter your name/i.test(e.message)) {
        setStep("name");
        setBackendRetryNeeded(false);
      } else {
        setErr(e.message || "Still couldn't reach our server. Please try again.");
      }
    }
    finally { setLoading(false); }
  };

  const submitName = async () => {
    setErr("");
    if (!name.trim()) return setErr("Please enter your name");
    setLoading(true);
    try {
      await loginToBackend(name);
    } catch (e) {
      setErr(e.message || "Could not create account. Please try again.");
    }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background:"#fff", borderRadius:20, padding:"20px 16px", boxShadow:"0 4px 24px rgba(0,0,0,0.06)", marginBottom:14 }}>
      <div id="recaptcha-container" />

      {step === "phone" && (
        <>
          <p style={{ fontSize:13, color:C.muted, marginBottom:16, textAlign:"center" }}>Enter your mobile number to continue</p>
          <PhoneInput
            value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}
            color={cfg.accent}
          />
          {err && (
            <div style={{ background:C.red+"12", border:`1.5px solid ${C.red}33`, borderRadius:12, padding:"11px 14px", marginBottom:14, display:"flex", gap:10, alignItems:"center" }}>
              <AlertCircle size={15} color={C.red} />
              <p style={{ color:C.red, fontSize:13, fontWeight:700 }}>{err}</p>
            </div>
          )}
          <button onClick={sendOtp} disabled={loading} style={{ width:"100%", padding:"15px", background:loading?"#E0E4EF":cfg.gradient, color:loading?"#AAB":"#fff", border:"none", borderRadius:14, fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:loading?"none":"0 6px 24px rgba(0,0,0,0.2)" }}>
            {loading ? "Sending..." : <><ShieldCheck size={17} /> Send OTP</>}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <p style={{ fontSize:13, color:C.muted, marginBottom:4, textAlign:"center" }}>OTP sent to <strong style={{ color:C.text }}>+91 {phone}</strong></p>
          <p style={{ fontSize:11, color:C.muted, marginBottom:16, textAlign:"center" }}>Don't see it? Check your spam/blocked messages folder</p>
          <button onClick={() => {setStep("phone"); setOtp(""); setErr(""); setBackendRetryNeeded(false);}} style={{ display:"block", margin:"0 auto 16px", background:"none", border:"none", color:cfg.accent, fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
            Change number
          </button>

          <OtpBoxes value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} color={cfg.accent} />

          {err && (
            <div style={{ background:C.red+"12", border:`1.5px solid ${C.red}33`, borderRadius:12, padding:"11px 14px", marginBottom:14, display:"flex", gap:10, alignItems:"center" }}>
              <AlertCircle size={15} color={C.red} />
              <p style={{ color:C.red, fontSize:13, fontWeight:700 }}>{err}</p>
            </div>
          )}

          <button onClick={backendRetryNeeded ? retryBackendLogin : verifyOtp} disabled={loading} style={{ width:"100%", padding:"15px", background:loading?"#E0E4EF":cfg.gradient, color:loading?"#AAB":"#fff", border:"none", borderRadius:14, fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:12, boxShadow:loading?"none":"0 6px 24px rgba(0,0,0,0.2)" }}>
            {loading ? (backendRetryNeeded ? "Retrying..." : "Verifying...") : backendRetryNeeded ? <><RotateCcw size={17} /> Retry</> : <><LogIn size={17} /> Verify & Continue</>}
          </button>

          {!backendRetryNeeded && (
            <button onClick={sendOtp} disabled={cooldown > 0 || loading} style={{ width:"100%", padding:"10px", background:"none", border:"none", color:cooldown>0?C.muted:cfg.accent, fontSize:12, fontWeight:800, cursor:cooldown>0?"default":"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <RotateCcw size={12} /> {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
            </button>
          )}
        </>
      )}

      {step === "name" && (
        <>
          <p style={{ fontSize:13, color:C.muted, marginBottom:16, textAlign:"center" }}>Phone verified! What should we call you?</p>
          <IconInput icon={User} label="YOUR NAME" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} color={cfg.accent} autoFocus />

          {err && (
            <div style={{ background:C.red+"12", border:`1.5px solid ${C.red}33`, borderRadius:12, padding:"11px 14px", marginBottom:14, display:"flex", gap:10, alignItems:"center" }}>
              <AlertCircle size={15} color={C.red} />
              <p style={{ color:C.red, fontSize:13, fontWeight:700 }}>{err}</p>
            </div>
          )}

          <button onClick={submitName} disabled={loading} style={{ width:"100%", padding:"15px", background:loading?"#E0E4EF":cfg.gradient, color:loading?"#AAB":"#fff", border:"none", borderRadius:14, fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:loading?"none":"0 6px 24px rgba(0,0,0,0.2)" }}>
            {loading ? "Creating account..." : <><UserPlus size={17} /> Create Account</>}
          </button>
        </>
      )}

      {GOOGLE_CLIENT_ID && (role === "customer" || role === "owner") && step === "phone" && (
        <div style={{ marginTop:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ flex:1, height:1, background:"#E8ECF5" }} />
            <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>OR</span>
            <div style={{ flex:1, height:1, background:"#E8ECF5" }} />
          </div>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={() => setErr("Google sign-in failed — please try again")} />
          </GoogleOAuthProvider>
        </div>
      )}
    </div>
  );
}

/* ── Auth Page ── */
export default function Auth() {
  const { role = "customer" } = useParams();
  const navigate  = useNavigate();
  const { login } = useAuth();

  const cfg = ROLES[role] || ROLES.customer;
  const RoleIcon = cfg.icon;

  const [tab,         setTab]         = useState("login");
  const [form,        setForm]        = useState({ name:"", email:"", phone:"", password:"", city:"", area:"" });
  const [err,         setErr]         = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showPw,      setShowPw]      = useState(false);
  const [locationSet, setLocationSet] = useState(false);

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleSubmit = async () => {
    setErr(""); setLoading(true);
    try {
      let res;
      if (tab === "login") {
        if (!form.email)    throw new Error("Please enter your email");
        if (!form.password) throw new Error("Please enter your password");
        res = await api("POST", "/auth/login", { email:form.email, password:form.password });
      } else {
        if (!form.name)     throw new Error("Please enter your full name");
        if (!form.email)    throw new Error("Please enter your email");
        if (!form.phone)    throw new Error("Please enter your phone number");
        if (!form.password) throw new Error("Password must be at least 6 characters");
        if (!form.city)     throw new Error("Please select your location");
        res = await api("POST", "/auth/register", { name:form.name, email:form.email, phone:form.phone, password:form.password, role, city:form.city, area:form.area });
      }
      login(res.user, res.token);
      navigate("/");
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const handleOtpSuccess = (res) => {
    login(res.user, res.token);
    navigate("/");
  };

  const usesOtpFlow = role === "customer" || role === "owner";

  return (
    <div style={{ minHeight:"100vh", background:"#F0F2F8", fontFamily:"'Nunito',sans-serif", display:"flex", flexDirection:"column" }}>

      <div style={{ background:cfg.gradient, padding:"52px 24px 56px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }} />
        <div style={{ position:"absolute", bottom:-20, left:-30, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />

        <button onClick={() => navigate("/")} style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", marginBottom:32 }}>
          <ArrowLeft size={18} color="#fff" />
        </button>

        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:60, height:60, borderRadius:20, background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(10px)" }}>
            <RoleIcon size={28} color="#fff" strokeWidth={1.6} />
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:cfg.accent }} />
              <span style={{ fontSize:11, color:cfg.accent, fontWeight:800, letterSpacing:2 }}>SLOTY</span>
            </div>
            <h1 style={{ fontSize:26, fontWeight:900, color:"#fff", lineHeight:1.1 }}>{cfg.label}</h1>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginTop:4 }}>{cfg.tagline}</p>
          </div>
        </div>
      </div>

      <div style={{ flex:1, background:"#F0F2F8", marginTop:-24, borderTopLeftRadius:28, borderTopRightRadius:28, padding:"24px 20px 60px", overflowY:"auto" }}>

        {usesOtpFlow ? (
          <CustomerOtpAuth cfg={cfg} role={role} onSuccess={handleOtpSuccess} />
        ) : (
          <>
            {role !== "admin" && (
              <div style={{ display:"flex", background:"#E4E8F0", borderRadius:16, padding:4, marginBottom:24 }}>
                {[
                  { key:"login",    label:"Sign In",  Icon:LogIn    },
                  { key:"register", label:"Register", Icon:UserPlus },
                ].map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => {setTab(key); setErr("");}} style={{ flex:1, padding:"12px 8px", border:"none", borderRadius:13, background:tab===key?"#fff":"transparent", color:tab===key?cfg.accent:C.muted, fontWeight:tab===key?900:600, cursor:"pointer", fontSize:13, fontFamily:"'Nunito',sans-serif", boxShadow:tab===key?"0 2px 12px rgba(0,0,0,0.1)":"none", display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"all 0.2s" }}>
                    <Icon size={14} strokeWidth={tab===key?2.5:1.8} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ background:"#fff", borderRadius:20, padding:"20px 16px", boxShadow:"0 4px 24px rgba(0,0,0,0.06)", marginBottom:14 }}>
              {tab === "register" && (
                <>
                  <IconInput icon={User}  label="FULL NAME"    placeholder="Your full name"         value={form.name}  onChange={e=>set("name",e.target.value)}  color={cfg.accent} />
                  <IconInput icon={Phone} label="PHONE NUMBER" placeholder="10-digit mobile number" value={form.phone} onChange={e=>set("phone",e.target.value)} color={cfg.accent} type="tel" />
                </>
              )}
              <IconInput icon={Mail} label="EMAIL ADDRESS" placeholder="your@email.com" value={form.email} onChange={e=>set("email",e.target.value)} type="email" color={cfg.accent} />
              <IconInput
                icon={Lock}
                label="PASSWORD"
                placeholder={tab==="login"?"Enter your password":"Min 6 characters"}
                value={form.password}
                onChange={e=>set("password",e.target.value)}
                type={showPw?"text":"password"}
                color={cfg.accent}
                right={
                  <button onClick={() => setShowPw(p=>!p)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", padding:4 }}>
                    {showPw ? <EyeOff size={16} color={C.muted} /> : <Eye size={16} color={C.muted} />}
                  </button>
                }
              />

              {tab === "register" && (
                <div style={{ marginTop:4 }}>
                  <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                    <MapPin size={13} color={C.muted} /> YOUR LOCATION
                  </label>
                  <LocationDetector onDetected={loc=>{set("city",loc.city);set("area",loc.area);setLocationSet(true);}} />
                  <div style={{ display:"flex", alignItems:"center", gap:8, margin:"10px 0" }}>
                    <div style={{ flex:1, height:1, background:"#E8ECF5" }} />
                    <span style={{ fontSize:11, color:C.muted }}>or search</span>
                    <div style={{ flex:1, height:1, background:"#E8ECF5" }} />
                  </div>
                  <MapPicker initialCity={form.city} onSelect={loc=>{set("city",loc.city);set("area",loc.area);setLocationSet(true);}} />
                  {locationSet && form.city && (
                    <div style={{ background:C.green+"15", borderRadius:12, padding:"10px 14px", marginTop:8, display:"flex", gap:8, alignItems:"center" }}>
                      <CheckCircle size={14} color={C.green} />
                      <p style={{ fontSize:12, color:C.green, fontWeight:800 }}>{form.area&&`${form.area}, `}{form.city}</p>
                    </div>
                  )}
                </div>
              )}

              {err && (
                <div style={{ background:C.red+"12", border:`1.5px solid ${C.red}33`, borderRadius:12, padding:"11px 14px", marginBottom:14, display:"flex", gap:10, alignItems:"center" }}>
                  <AlertCircle size={15} color={C.red} />
                  <p style={{ color:C.red, fontSize:13, fontWeight:700 }}>{err}</p>
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading} style={{ width:"100%", padding:"15px", background:loading?"#E0E4EF":cfg.gradient, color:loading?"#AAB":"#fff", border:"none", borderRadius:14, fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginTop:4, boxShadow:loading?"none":`0 6px 24px rgba(0,0,0,0.2)`, transition:"all 0.2s" }}>
                {loading ? (
                  <>
                    <div style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.4)", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                    Please wait...
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </>
                ) : tab==="login" ? (
                  <><LogIn size={17} /> Sign In</>
                ) : (
                  <><UserPlus size={17} /> Create Account</>
                )}
              </button>
            </div>
          </>
        )}

        {/* Dev-only convenience — a real user should never see credential
            autofill on their login screen; it reads as an unfinished
            build. Still available while running `vite dev` locally. */}
        {!usesOtpFlow && import.meta.env.DEV && (
          <div style={{ background:C.sec, borderRadius:18, padding:"14px 16px", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12 }}>
              <Zap size={13} color={cfg.accent} />
              <p style={{ fontSize:11, fontWeight:800, color:"rgba(255,255,255,0.4)", letterSpacing:1 }}>DEMO ACCOUNTS</p>
            </div>
            {[
              { label:"Admin", email:"admin@demo.com", color:"#FFD23F" },
            ].map(({ label, email, color }) => (
              <div key={label} onClick={() => {set("email",email);set("password","demo123");}} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid rgba(255,255,255,0.06)`, cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:color+"22", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:10, fontWeight:900, color }}>{label[0]}</span>
                  </div>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:700 }}>{label}</span>
                </div>
                <span style={{ fontSize:11, color:color, fontWeight:700 }}>{email}</span>
              </div>
            ))}
            <p style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginTop:10, textAlign:"center" }}>Password: demo123 · Tap to autofill</p>
          </div>
        )}

      </div>
    </div>
  );
}