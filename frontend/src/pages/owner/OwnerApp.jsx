import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import { C, CATS, getCat } from "../../constants";
import { Badge, Card, Btn, Input, Select, Loader, MapPicker, LocationDetector, BottomSheet, BottomNav } from "../../components/UI";
// Lazy-loaded — each ships as its own chunk instead of bloating the
// single OwnerApp bundle every owner downloads on login regardless of
// which tabs they actually visit. OwnerAnalytics alone pulls in
// recharts, a genuinely large dependency that has no business being in
// the initial bundle for an owner who only ever checks the Queue tab.
const OwnerOffers       = lazy(() => import("../../components/OwnerOffers"));
const OwnerMessages     = lazy(() => import("../../components/OwnerMessages"));
const OwnerAnalytics    = lazy(() => import("../../components/OwnerAnalytics"));
const OwnerBlockedDates = lazy(() => import("../../components/OwnerBlockedDates"));
const OwnerBreakTimes   = lazy(() => import("../../components/OwnerBreakTimes"));
import { getISTDateString, getISTNow, getNext7Days } from "../../utils/date";
import { getSocket, joinRoom, leaveRoom } from "../../utils/socket";
import { playChime } from "../../utils/sound";
import { enablePushNotifications } from "../../utils/push";
import {
  ListOrdered, Wrench, Settings, Tag,
  MapPin, Phone, Clock, IndianRupee, LogOut, Circle,
  CheckCircle, AlertCircle, Users, TrendingUp, Store,
  Plus, Trash2, ShieldCheck, XCircle, PlayCircle,
  CalendarDays, Timer, ChevronRight, Save, Coffee, History, Edit2, Wallet, BarChart3,
  Image as ImageIcon, X, UserPlus, Bell,
  FileText, Send, MessageCircle, Mail, Ban, Search, ArrowLeft
} from "lucide-react";

/* ── Upload an image file directly to Cloudinary (unsigned upload preset).
   Returns the secure HTTPS URL of the uploaded image. Stores only the
   URL in MongoDB — never the raw image data — keeping document sizes tiny. ── */
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD || "";
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET || "";

const uploadToCloudinary = async (file) => {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
    throw new Error("Cloudinary not configured. Add VITE_CLOUDINARY_CLOUD and VITE_CLOUDINARY_PRESET to frontend/.env");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Image upload failed. Please try again.");
  const data = await res.json();
  return data.secure_url; // HTTPS URL — this is what gets stored in MongoDB
};

/* ── Store photo grid + uploader ── */
function PhotoUploader({ photos, onChange }) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (fileList) => {
    const remaining = 4 - photos.length;
    if (remaining <= 0) return;
    const files = Array.from(fileList).slice(0, remaining);
    setBusy(true);
    try {
      const urls = await Promise.all(files.map(f => uploadToCloudinary(f)));
      onChange([...photos, ...urls]);
    } catch (e) {
      alert(e.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (idx) => onChange(photos.filter((_, i) => i !== idx));

  return (
    <Card>
      <SectionHeader icon={ImageIcon} title="Store Photos" />
      <p style={{ fontSize:11, color:C.muted, marginBottom:12 }}>Add up to 4 photos. The first one is used as your store's cover image.</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position:"relative", borderRadius:14, overflow:"hidden", aspectRatio:"1", background:C.inputBg }}>
            <img src={p} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
            {i === 0 && (
              <span style={{ position:"absolute", top:6, left:6, background:C.pri, color:"#fff", fontSize:9, fontWeight:800, padding:"2px 8px", borderRadius:10 }}>COVER</span>
            )}
            <button
              onClick={() => removePhoto(i)}
              style={{ position:"absolute", top:6, right:6, width:22, height:22, borderRadius:"50%", background:"rgba(0,0,0,0.6)", border:"none", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {photos.length < 4 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            style={{ aspectRatio:"1", border:`2px dashed ${C.pri}44`, borderRadius:14, background:C.pri+"08", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, cursor:busy?"not-allowed":"pointer" }}
          >
            <Plus size={22} color={C.pri} />
            <span style={{ fontSize:11, fontWeight:700, color:C.pri }}>{busy?"Uploading...":"Add Photo"}</span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display:"none" }}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
    </Card>
  );
}

/* ── Section header helper ── */
const SectionHeader = ({ icon: Icon, title, color=C.pri }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
    <div style={{ width:32, height:32, borderRadius:10, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Icon size={16} color={color} />
    </div>
    <h3 style={{ fontSize:14, fontWeight:900, color:C.text, margin:0 }}>{title}</h3>
  </div>
);

/* ── Stat Card ── */
// Correct English ordinal suffix — handles the 11th/12th/13th special
// case (not 11st/12nd/13rd), which a naive "last digit" check gets wrong.
function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = n % 10;
  return `${n}${rem10===1?"st":rem10===2?"nd":rem10===3?"rd":"th"}`;
}

// Converts "9:00 AM" / "2:30 PM" style strings to minutes-since-midnight.
// Needed anywhere bookings/slots need real overlap math instead of
// alphabetical or exact-string comparison, since "2:00 PM" < "10:30 AM"
// as plain strings even though it's chronologically later.
function slotTimeToMinutes(t) {
  const [time, period] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

const StatCard = ({ icon: Icon, value, label, color, onClick }) => (
  <div onClick={onClick} style={{ background:C.card, borderRadius:18, padding:16, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", borderLeft:`4px solid ${color}`, flex:1, cursor:onClick?"pointer":"default" }}>
    <div style={{ width:36, height:36, borderRadius:12, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}>
      <Icon size={18} color={color} />
    </div>
    <div style={{ fontSize:22, fontWeight:900, color }}>{value}</div>
    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{label}</div>
  </div>
);

/* ── Independent per-section Save button, used at the bottom of every
   settings Card. Each section saves ONLY its own fields — editing
   Working Hours doesn't require touching Services first, and vice
   versa. `status` is { loading, success, error } for just this one
   section, kept separate from every other section's own status. ── */
const SectionSaveButton = ({ status, onSave, disabled }) => (
  <div style={{ marginTop:14 }}>
    {status?.error   && <p style={{ color:C.red,   fontSize:12, fontWeight:700, marginBottom:8 }}>{status.error}</p>}
    {status?.success && <p style={{ color:C.green, fontSize:12, fontWeight:700, marginBottom:8, display:"flex", alignItems:"center", gap:5 }}><CheckCircle size={13} /> {status.success}</p>}
    <button onClick={onSave} disabled={status?.loading || disabled} style={{ width:"100%", padding:"12px", background:(status?.loading||disabled)?"#E0E4EF":C.pri, color:(status?.loading||disabled)?"#AAB":"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:800, cursor:(status?.loading||disabled)?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
      <Save size={14} /> {status?.loading?"Saving...":"Save Changes"}
    </button>
  </div>
);

/* ── "Edit" toggle placed in each settings section's header — fields
   inside that section stay visible but locked (dimmed, non-interactive)
   until tapped, preventing accidental changes. Each section locks/
   unlocks completely independently of every other one. ── */
const SectionEditToggle = ({ isEditing, onToggle }) => (
  <button onClick={onToggle} style={{ background:isEditing?C.green+"15":C.pri+"15", color:isEditing?C.green:C.pri, border:"none", borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
    <Edit2 size={12} /> {isEditing ? "Editing" : "Edit"}
  </button>
);

/* Wraps a section's fields — dims + disables pointer interaction while
   locked. Works regardless of what's inside (plain inputs, MapPicker,
   TimeInput12h, StaffManager's dynamic rows) without needing to modify
   any of those components individually. */
const LockableSection = ({ isEditing, children }) => (
  <div style={{ opacity:isEditing?1:0.6, pointerEvents:isEditing?"auto":"none", transition:"opacity 0.15s" }}>
    {children}
  </div>
);

/* ── Staff / doctor management — multi-staff stores get an independent
   queue and token sequence per staff member. Off by default so
   single-chair salons and one-mechanic garages are unaffected. ── */
function StaffManager({ hasStaff, onToggleHasStaff, staff, onChange, slotCapacity, onCapacityChange, saveStatus, onSave, isEditing, onToggleEdit }) {
  const addStaff = () => onChange([...staff, { name:"", specialization:"", isActive:true }]);
  const updateStaff = (i, field, val) => onChange(staff.map((s,j) => j===i ? { ...s, [field]: val } : s));
  const removeStaff = (i) => onChange(staff.filter((_,j) => j!==i));
  const toggleActive = (i) => onChange(staff.map((s,j) => j===i ? { ...s, isActive: !s.isActive } : s));

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <SectionHeader icon={Users} title="Staff / Doctors" />
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <SectionEditToggle isEditing={isEditing} onToggle={onToggleEdit} />
          <button
            onClick={() => isEditing && onToggleHasStaff(!hasStaff)}
            disabled={!isEditing}
            style={{ width:46, height:26, borderRadius:14, background:hasStaff?C.green:"#E0E4EF", border:"none", cursor:isEditing?"pointer":"not-allowed", position:"relative", transition:"background 0.2s", flexShrink:0, opacity:isEditing?1:0.6 }}
          >
            <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:hasStaff?23:3, transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
      </div>
      <p style={{ fontSize:11, color:C.muted, marginBottom:14 }}>
        {hasStaff
          ? "Customers will pick a specific staff member before booking. Each staff member gets their own queue and token sequence."
          : "Turn this on if multiple doctors, barbers, or mechanics work here and customers should pick a specific person."}
      </p>

      <LockableSection isEditing={isEditing}>
      {!hasStaff && (
        <div style={{ background:C.pri+"08", border:`1.5px solid ${C.pri}22`, borderRadius:14, padding:14, marginBottom:4 }}>
          <label style={{ fontSize:12, fontWeight:800, color:C.text, display:"block", marginBottom:4 }}>
            How many customers can you serve in the same time slot?
          </label>
          <p style={{ fontSize:11, color:C.muted, marginBottom:10 }}>
            e.g. a barbershop with 3 interchangeable barbers can serve 3 customers at once — set this to 3, and up to 3 people can book the same time slot without ever picking a staff name.
          </p>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => onCapacityChange(Math.max(1, (slotCapacity||1) - 1))} style={{ width:36, height:36, borderRadius:10, border:"2px solid #E8ECF5", background:C.card, fontSize:18, fontWeight:800, color:C.pri, cursor:"pointer" }}>−</button>
            <div style={{ flex:1, textAlign:"center", fontSize:22, fontWeight:900, color:C.pri }}>{slotCapacity||1}</div>
            <button onClick={() => onCapacityChange((slotCapacity||1) + 1)} style={{ width:36, height:36, borderRadius:10, border:"2px solid #E8ECF5", background:C.card, fontSize:18, fontWeight:800, color:C.pri, cursor:"pointer" }}>+</button>
          </div>
        </div>
      )}

      {hasStaff && (
        <>
          {staff.map((s, i) => (
            <div key={i} style={{ background: s.isActive?C.inputBg:C.bg, borderRadius:14, padding:12, marginBottom:10, border:`2px solid ${s.isActive?"#E8ECF5":"#E0E0E0"}`, opacity: s.isActive?1:0.6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:11, fontWeight:800, color:C.muted }}>STAFF {i+1}</span>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => toggleActive(i)} style={{ background:s.isActive?C.green+"15":C.muted+"15", color:s.isActive?C.green:C.muted, border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"'Nunito',sans-serif" }}>
                    {s.isActive?"Active":"Hidden"}
                  </button>
                  <button onClick={() => removeStaff(i)} style={{ background:C.red+"15", color:C.red, border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
              </div>
              <input
                value={s.name}
                onChange={e=>updateStaff(i, "name", e.target.value)}
                placeholder="e.g. Dr. Priya Sharma"
                style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontFamily:"'Nunito',sans-serif", marginBottom:8, boxSizing:"border-box", background:C.inputBg }}
              />
              <input
                value={s.specialization}
                onChange={e=>updateStaff(i, "specialization", e.target.value)}
                placeholder="e.g. Cardiologist, Senior Barber"
                style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg }}
              />
            </div>
          ))}
          <button onClick={addStaff} style={{ padding:"12px 20px", background:C.pri+"15", color:C.pri, border:`2px dashed ${C.pri}44`, borderRadius:12, cursor:"pointer", fontWeight:800, fontFamily:"'Nunito',sans-serif", fontSize:13, width:"100%", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <UserPlus size={14} /> Add Staff Member
          </button>
        </>
      )}
      </LockableSection>
      <SectionSaveButton status={saveStatus} onSave={onSave} disabled={!isEditing} />
    </Card>
  );
}

/* ── 12-hour AM/PM time picker — replaces native <input type="time">
   which always follows the OS locale (often 24-hour) and can't be
   forced into AM/PM via CSS/JS. Internally still stores/returns
   "HH:MM" 24-hour strings so the backend slot logic is unaffected. ── */
function TimeInput12h({ label, value, onChange }) {
  const parseValue = (v) => {
    if (!v) return { h12: "", m: "", period: "" };
    const [hh, mm] = v.split(":").map(Number);
    const period = hh >= 12 ? "PM" : "AM";
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return { h12: String(h12), m: String(mm || 0), period };
  };

  // Local state holds each dropdown's own selection independently, so
  // picking the hour doesn't get wiped out while the minute/AM-PM are
  // still unset. Only once all three are chosen do we report a real
  // value up to the parent — until then the parent's `value` stays "".
  const [local, setLocal] = useState(parseValue(value));

  // If the parent resets `value` back to empty (e.g. switching stores),
  // reset local selections too.
  useEffect(() => {
    if (!value) setLocal({ h12:"", m:"", period:"" });
  }, [value]);

  const isEmpty = !value;

  const handleChange = (part, newVal) => {
    const next = { ...local, [part]: newVal };
    setLocal(next);
    if (next.h12 !== "" && next.m !== "" && next.period !== "") {
      let hh = Number(next.h12) % 12;
      if (next.period === "PM") hh += 12;
      onChange(`${String(hh).padStart(2,"0")}:${String(next.m).padStart(2,"0")}`);
    } else {
      onChange(""); // still incomplete — parent correctly sees this as unset
    }
  };

  const selectStyle = { flex:1, padding:"12px 6px", border:`2px solid ${isEmpty?"#FCD34D":"#E8ECF5"}`, borderRadius:12, fontSize:14, fontWeight:700, fontFamily:"'Nunito',sans-serif", background:isEmpty?"#FFFBEB":"#fff", color:isEmpty?"#B45309":C.text, textAlign:"center" };

  return (
    <div style={{ flex:1 }}>
      {label && <label style={{ fontSize:11, fontWeight:800, color:isEmpty?"#B45309":C.muted, display:"block", marginBottom:5 }}>{label}{isEmpty?" — tap to set":""}</label>}
      <div style={{ display:"flex", gap:6 }}>
        <select value={local.h12} onChange={e=>handleChange("h12", e.target.value)} style={selectStyle}>
          <option value="">--</option>
          {Array.from({length:12},(_,i)=>i+1).map(h=><option key={h} value={h}>{h}</option>)}
        </select>
        <select value={local.m} onChange={e=>handleChange("m", e.target.value)} style={selectStyle}>
          <option value="">--</option>
          {[0,15,30,45].map(mm=><option key={mm} value={mm}>{String(mm).padStart(2,"0")}</option>)}
        </select>
        <select value={local.period} onChange={e=>handleChange("period", e.target.value)} style={{...selectStyle, flex:0.7, fontWeight:800, color:isEmpty?"#B45309":C.pri}}>
          <option value="">--</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

/* ── OwnerSettings ── */
function OwnerSettings({ myStore, onUpdate, user }) {
  // Separate from the store form below — email lives on the owner's own
  // account (User model), not the store, and saves through a different
  // endpoint (/auth/update-profile, not /stores/:id). Owners who signed
  // up via phone+OTP never entered an email anywhere, so this is often
  // genuinely empty for them, not just uneditable — unlike the store
  // fields, which always have a real starting value from registration.
  const [emailForm, setEmailForm] = useState(user?.email && !/^\d{10}@(owner\.)?sloty\.com$/i.test(user.email) ? user.email : "");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const isPlaceholderEmail = !user?.email || /^\d{10}@(owner\.)?sloty\.com$/i.test(user.email);

  const saveEmail = async () => {
    if (!emailForm.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.trim())) {
      setEmailStatus({ loading:false, success:"", error:"Enter a valid email address" });
      return;
    }
    setEmailStatus({ loading:true, success:"", error:"" });
    try {
      await api("PUT", "/auth/update-profile", { email: emailForm.trim() });
      setEmailStatus({ loading:false, success:"Saved!", error:"" });
      setEditingEmail(false);
      setTimeout(() => setEmailStatus(s => ({ ...s, success:"" })), 2200);
    } catch(e) {
      setEmailStatus({ loading:false, success:"", error:e.message });
    }
  };

  const [form, setForm] = useState({
    name: myStore.name||"", phone: myStore.phone||"",
    address: myStore.address||"", pincode: myStore.pincode||"",
    workingHours: { open: myStore.workingHours?.open||"", close: myStore.workingHours?.close||"" },
    breakTimes: myStore.breakTimes||[], blockedSlots: myStore.blockedSlots||[],
  });
  const [services, setServices] = useState(myStore.services||[]);
  const [photos,   setPhotos]   = useState(myStore.photos||[]);
  const [hasStaff, setHasStaff] = useState(myStore.hasStaff||false);
  const [slotCapacity, setSlotCapacity] = useState(myStore.slotCapacity||1);
  const [staff,    setStaff]    = useState(myStore.staff||[]);
  const [storeLoc, setStoreLoc] = useState({ lat: myStore.location?.lat ?? null, lng: myStore.location?.lng ?? null });
  const [sectionStatus, setSectionStatus] = useState({}); // { [sectionKey]: {loading, success, error} }
  // Each section starts locked — fields are visible but non-interactive
  // until "Edit" is tapped. Locks back automatically after a
  // successful save (handled inside saveSection below).
  const [editing, setEditing] = useState({ storeInfo:false, location:false, hours:false, services:false, staff:false, breaks:false });
  const toggleEdit = (key) => setEditing(e => ({ ...e, [key]: !e[key] }));
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Generic per-section save — sends ONLY the fields belonging to that
  // one section, so saving Working Hours never touches Services, etc.
  // `validate` is optional and returns an error string, or nothing if OK.
  const saveSection = async (key, fields, validate) => {
    if (validate) {
      const validationError = validate();
      if (validationError) {
        setSectionStatus(s => ({ ...s, [key]: { loading:false, success:"", error:validationError } }));
        return;
      }
    }
    setSectionStatus(s => ({ ...s, [key]: { loading:true, success:"", error:"" } }));
    try {
      await api("PUT", `/stores/${myStore._id}`, fields);
      setSectionStatus(s => ({ ...s, [key]: { loading:false, success:"Saved!", error:"" } }));
      onUpdate({ ...myStore, ...fields });
      setEditing(e => ({ ...e, [key]: false }));
      setTimeout(() => setSectionStatus(s => ({ ...s, [key]: { ...(s[key]||{}), success:"" } })), 2200);
    } catch(e) {
      setSectionStatus(s => ({ ...s, [key]: { loading:false, success:"", error:e.message } }));
    }
  };

  // ── Help & Support (owner-side report form) ──────────────────────────────
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportCategory, setReportCategory] = useState("store_issue");
  const [reportSubject,  setReportSubject]  = useState("");
  const [reportMessage,  setReportMessage]  = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess,  setReportSuccess]  = useState("");
  const [reportErr,      setReportErr]      = useState("");

  const submitTicket = async () => {
    if (!reportSubject.trim() || !reportMessage.trim()) { setReportErr("Please fill in both the subject and details"); return; }
    setReportErr(""); setReportSubmitting(true);
    try {
      await api("POST", "/support", { category: reportCategory, subject: reportSubject, message: reportMessage });
      setReportSuccess("Report submitted — our team will look into it soon.");
      setReportSubject(""); setReportMessage("");
      setTimeout(() => { setShowReportForm(false); setReportSuccess(""); }, 1800);
    } catch (e) { setReportErr(e.message); }
    finally { setReportSubmitting(false); }
  };

  const timeInput = (label, value, onChange) => (
    <TimeInput12h label={label} value={value} onChange={(v) => onChange({ target: { value: v } })} />
  );

  return (
    <div>
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <SectionHeader icon={Mail} title="Your Email" />
          <SectionEditToggle isEditing={editingEmail} onToggle={() => setEditingEmail(v=>!v)} />
        </div>
        {isPlaceholderEmail && (
          <div style={{ background:C.acc+"15", borderRadius:10, padding:"10px 14px", marginBottom:12, display:"flex", gap:8, alignItems:"flex-start" }}>
            <AlertCircle size={14} color="#92610A" style={{ flexShrink:0, marginTop:1 }} />
            <p style={{ fontSize:11, color:"#92610A", fontWeight:700, lineHeight:1.4 }}>No email on file yet — add one so booking notifications and receipts actually reach you.</p>
          </div>
        )}
        <LockableSection isEditing={editingEmail}>
          <Input label="Email Address" value={emailForm} onChange={e=>setEmailForm(e.target.value)} placeholder="your.email@example.com" type="email" disabled={!editingEmail} />
        </LockableSection>
        <SectionSaveButton status={emailStatus} disabled={!editingEmail} onSave={saveEmail} />
      </Card>

      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <SectionHeader icon={Store} title="Store Info" />
          <SectionEditToggle isEditing={editing.storeInfo} onToggle={() => toggleEdit("storeInfo")} />
        </div>
        <LockableSection isEditing={editing.storeInfo}>
          <Input label="Store Name" value={form.name}    onChange={e=>set("name",e.target.value)}    placeholder="Store name" disabled={!editing.storeInfo} />
          <Input label="Phone"      value={form.phone}   onChange={e=>set("phone",e.target.value)}   placeholder="Store phone" type="tel" disabled={!editing.storeInfo} />
          <Input label="Address"    value={form.address} onChange={e=>set("address",e.target.value)} placeholder="Full address" disabled={!editing.storeInfo} />
          <Input label="Pincode"    value={form.pincode} onChange={e=>set("pincode",e.target.value)} placeholder="6-digit pincode" disabled={!editing.storeInfo} />
        </LockableSection>
        <SectionSaveButton
          status={sectionStatus.storeInfo}
          disabled={!editing.storeInfo}
          onSave={() => saveSection("storeInfo", { name:form.name, phone:form.phone, address:form.address, pincode:form.pincode })}
        />
      </Card>

      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <SectionHeader icon={MapPin} title="Store Location" />
          <SectionEditToggle isEditing={editing.location} onToggle={() => toggleEdit("location")} />
        </div>
        <p style={{ fontSize:11, color:C.muted, marginBottom:12 }}>
          {storeLoc.lat ? "Location set — powers accurate \"time to head out\" reminders for customers." : "Not set yet. Add it so customer reminders can account for travel time."}
        </p>
        <LockableSection isEditing={editing.location}>
          <LocationDetector onDetected={loc=>setStoreLoc({ lat:loc.lat, lng:loc.lng })} />
          <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginBottom:8 }}>— or search your address —</p>
          <MapPicker initialCity="" onSelect={loc=>setStoreLoc({ lat:loc.lat, lng:loc.lng })} />
          {storeLoc.lat && (
            <div style={{ background:C.green+"15", borderRadius:10, padding:"10px 14px", marginTop:6, display:"flex", gap:8, alignItems:"center" }}>
              <CheckCircle size={14} color={C.green} />
              <p style={{ fontSize:12, color:C.green, fontWeight:800 }}>Location saved ({storeLoc.lat.toFixed(4)}, {storeLoc.lng.toFixed(4)})</p>
            </div>
          )}
        </LockableSection>
        <SectionSaveButton
          status={sectionStatus.location}
          disabled={!editing.location}
          onSave={() => saveSection("location", { location: storeLoc })}
        />
      </Card>

      <PhotoUploader photos={photos} onChange={async (newPhotos) => {
        setPhotos(newPhotos);
        // Auto-save photos immediately so they don't get lost if owner
        // navigates away without clicking "Save Changes" — only this
        // section's own field is sent, same principle as every other
        // independent per-section save.
        try {
          await api("PUT", `/stores/${myStore._id}`, { photos: newPhotos });
          onUpdate({ ...myStore, photos: newPhotos });
        } catch(e) { console.error("Photo auto-save failed:", e.message); }
      }} />

      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <SectionHeader icon={Clock} title="Working Hours" />
          <SectionEditToggle isEditing={editing.hours} onToggle={() => toggleEdit("hours")} />
        </div>
        <LockableSection isEditing={editing.hours}>
          <div style={{ display:"flex", gap:10 }}>
            {timeInput("OPENS AT",  form.workingHours.open,  e=>set("workingHours",{...form.workingHours,open:e.target.value}))}
            {timeInput("CLOSES AT", form.workingHours.close, e=>set("workingHours",{...form.workingHours,close:e.target.value}))}
          </div>
        </LockableSection>
        <SectionSaveButton
          status={sectionStatus.hours}
          disabled={!editing.hours}
          onSave={() => saveSection("hours", { workingHours: form.workingHours }, () => {
            if (!form.workingHours.open || !form.workingHours.close) return "Please set both opening and closing time";
          })}
        />
      </Card>

      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <SectionHeader icon={Wrench} title="Services" />
          <SectionEditToggle isEditing={editing.services} onToggle={() => toggleEdit("services")} />
        </div>
        <LockableSection isEditing={editing.services}>
        {services.map((s,i) => (
          <div key={i} style={{ background:C.inputBg, borderRadius:14, padding:12, marginBottom:10, border:"2px solid #E8ECF5" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:11, fontWeight:800, color:C.muted }}>SERVICE {i+1}</span>
              {services.length > 1 && (
                <button onClick={() => setServices(sv=>sv.filter((_,j)=>j!==i))} style={{ background:C.red+"15", color:C.red, border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>
            <input value={s.name} onChange={e=>setServices(sv=>sv.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Service name" style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontFamily:"'Nunito',sans-serif", marginBottom:10, boxSizing:"border-box", background:C.inputBg }} />
            <div onClick={()=>setServices(sv=>sv.map((x,j)=>j===i?{...x,isPriceVariable:!x.isPriceVariable, price:!x.isPriceVariable?0:x.price}:x))} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, cursor:"pointer", padding:"8px 10px", background:s.isPriceVariable?C.acc+"15":"transparent", borderRadius:8 }}>
              <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${s.isPriceVariable?C.acc:"#D0D4E0"}`, background:s.isPriceVariable?C.acc:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {s.isPriceVariable && <CheckCircle size={11} color="#fff" />}
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:s.isPriceVariable?"#92610A":C.muted }}>Variable pricing (price shown as "on inspection")</span>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {!s.isPriceVariable && (
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:10, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>PRICE (₹)</label>
                  <input value={s.price||""} onChange={e=>setServices(sv=>sv.map((x,j)=>j===i?{...x,price:Number(e.target.value)}:x))} onWheel={e=>e.target.blur()} placeholder="150" type="number" min="0" style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:14, fontWeight:800, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg, color:C.pri }} />
                </div>
              )}
              <div style={{ flex:1 }}>
                <label style={{ fontSize:10, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>DURATION (MIN)</label>
                <input value={s.duration||""} onChange={e=>setServices(sv=>sv.map((x,j)=>j===i?{...x,duration:Number(e.target.value)}:x))} onWheel={e=>e.target.blur()} placeholder="30" type="number" min="5" step="5" style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:14, fontWeight:800, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg, color:C.blue }} />
              </div>
            </div>
            <label style={{ fontSize:10, fontWeight:800, color:C.muted, display:"block", marginTop:10, marginBottom:5 }}>REMIND CUSTOMER TO REBOOK AFTER (DAYS) — OPTIONAL</label>
            <input value={s.recurrenceDays||""} onChange={e=>setServices(sv=>sv.map((x,j)=>j===i?{...x,recurrenceDays:e.target.value?Number(e.target.value):null}:x))} onWheel={e=>e.target.blur()} placeholder="e.g. 30 for a monthly service" type="number" min="1" style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontWeight:700, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg, color:C.acc }} />
          </div>
        ))}
        <button onClick={() => setServices(sv=>[...sv,{name:"",price:0,duration:30,recurrenceDays:null}])} style={{ padding:"12px 20px", background:C.pri+"15", color:C.pri, border:`2px dashed ${C.pri}44`, borderRadius:12, cursor:"pointer", fontWeight:800, fontFamily:"'Nunito',sans-serif", fontSize:13, width:"100%", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          <Plus size={14} /> Add Service
        </button>
        </LockableSection>
        <SectionSaveButton
          status={sectionStatus.services}
          disabled={!editing.services}
          onSave={() => saveSection("services", { services }, () => {
            if (services.some(s=>!s.name||(!s.isPriceVariable && !s.price))) return "Please fill all service details";
          })}
        />
      </Card>

      <StaffManager
        hasStaff={hasStaff} onToggleHasStaff={setHasStaff}
        staff={staff} onChange={setStaff}
        slotCapacity={slotCapacity} onCapacityChange={setSlotCapacity}
        saveStatus={sectionStatus.staff}
        isEditing={editing.staff}
        onToggleEdit={() => toggleEdit("staff")}
        onSave={() => saveSection("staff", { hasStaff, staff, slotCapacity }, () => {
          if (hasStaff && staff.some(s=>!s.name)) return "Please name every staff member, or remove the empty one";
        })}
      />

      <Card>
        <SectionHeader icon={MessageCircle} title="Help & Support" color={C.blue} />
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <a href="tel:+918317588958" style={{ flex:1, textDecoration:"none" }}>
            <div style={{ background:C.inputBg, border:"1.5px solid #E8ECF5", borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
              <Phone size={14} color={C.green} />
              <p style={{ fontSize:10, fontWeight:800, color:C.text, marginTop:4 }}>Call</p>
            </div>
          </a>
          <a href="https://wa.me/918317588958" target="_blank" rel="noreferrer" style={{ flex:1, textDecoration:"none" }}>
            <div style={{ background:C.inputBg, border:"1.5px solid #E8ECF5", borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
              <MessageCircle size={14} color="#25D366" />
              <p style={{ fontSize:10, fontWeight:800, color:C.text, marginTop:4 }}>WhatsApp</p>
            </div>
          </a>
          <a href="mailto:support@sloty.app" style={{ flex:1, textDecoration:"none" }}>
            <div style={{ background:C.inputBg, border:"1.5px solid #E8ECF5", borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
              <Mail size={14} color={C.blue} />
              <p style={{ fontSize:10, fontWeight:800, color:C.text, marginTop:4 }}>Email</p>
            </div>
          </a>
        </div>
        <button onClick={() => setShowReportForm(true)} style={{ width:"100%", padding:"12px", background:C.pri+"12", color:C.pri, border:`1.5px solid ${C.pri}33`, borderRadius:12, fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
          <FileText size={14} /> Report a Problem
        </button>
      </Card>

      <BottomSheet open={showReportForm} onClose={() => setShowReportForm(false)} title="Report a Problem">
        {reportSuccess ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <CheckCircle size={36} color={C.green} />
            <p style={{ fontSize:14, fontWeight:800, color:C.green, marginTop:10 }}>{reportSuccess}</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:6 }}>CATEGORY</label>
              <select value={reportCategory} onChange={e=>setReportCategory(e.target.value)} style={{ width:"100%", padding:"12px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, background:C.inputBg, color:C.text, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box" }}>
                <option value="store_issue">Store / Listing Issue</option>
                <option value="booking_issue">Booking Issue</option>
                <option value="payment_issue">Payment Issue</option>
                <option value="app_bug">App Bug</option>
                <option value="account">Account Issue</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Input label="Subject" placeholder="Briefly describe the issue" value={reportSubject} onChange={e=>setReportSubject(e.target.value)} />
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:6 }}>DETAILS</label>
              <textarea
                value={reportMessage}
                onChange={e=>setReportMessage(e.target.value)}
                placeholder="Tell us what happened..."
                rows={4}
                style={{ width:"100%", padding:"13px 16px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, color:C.text, background:C.inputBg, outline:"none", fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", resize:"none" }}
              />
            </div>
            {reportErr && (
              <div style={{ background:C.red+"12", border:`1.5px solid ${C.red}33`, borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", gap:8, alignItems:"center" }}>
                <AlertCircle size={14} color={C.red} />
                <p style={{ color:C.red, fontSize:12, fontWeight:700 }}>{reportErr}</p>
              </div>
            )}
            <Btn onClick={submitTicket} disabled={reportSubmitting} color={C.pri}>
              {reportSubmitting ? "Submitting..." : "Submit Report"}
            </Btn>
          </>
        )}
      </BottomSheet>
    </div>
  );
}

/* ── OwnerApp ── */
export default function OwnerApp() {
  const { user, logout } = useAuth();
  // Restores the tab after a browser-triggered reload (Android killing
  // a backgrounded tab under memory pressure) — see the matching
  // comment in CustomerApp.jsx for the full reasoning.
  const [tab,         setTab]         = useState(() => sessionStorage.getItem("sloty-owner-tab") || "dashboard");
  const [myStore,     setMyStore]     = useState(null);
  const [bookings,    setBookings]    = useState([]);
  const [history,     setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [showReg,     setShowReg]     = useState(false);

  // Syncs the active tab AND the registration overlay with real browser
  // history, so Android's native back gesture and the on-screen/
  // hardware back button both correctly step backward — closing the
  // registration overlay first if it's open, then navigating tabs.
  const isPoppingRef = useRef(false);
  useEffect(() => {
    if (isPoppingRef.current) { isPoppingRef.current = false; return; }
    window.history.pushState({ tab, overlayOpen: showReg }, "");
  }, [tab, showReg]);
  useEffect(() => {
    const onPopState = (e) => {
      isPoppingRef.current = true;
      if (!e.state?.overlayOpen) setShowReg(false);
      if (e.state?.tab) setTab(e.state.tab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [err,         setErr]         = useState("");
  // Held at this level (not inside OwnerMessages) so the currently-open
  // conversation survives switching to another tab and back — the
  // Messages tab content is conditionally rendered per-tab, which fully
  // unmounts OwnerMessages on every tab switch.
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [otpErr,      setOtpErr]      = useState({});
  const [staffFilter, setStaffFilter] = useState("all"); // "all" or a staff _id
  const [bookingSearch, setBookingSearch] = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [customerHistory, setCustomerHistory] = useState(null); // { name, phone, bookings } | null
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [gridDate, setGridDate] = useState(() => getISTDateString());
  const [showManageSlots, setShowManageSlots] = useState(false);
  const [addServiceBooking, setAddServiceBooking] = useState(null); // booking object | null
  const [addServiceErr, setAddServiceErr] = useState("");
  const [addServiceLoading, setAddServiceLoading] = useState(false);
  const [addServiceWarning, setAddServiceWarning] = useState("");

  const addServiceToBooking = async (bookingId, serviceName) => {
    setAddServiceErr(""); setAddServiceLoading(true);
    try {
      const res = await api("PUT", `/bookings/${bookingId}/add-service`, { serviceName });
      setBookings(bk => bk.map(x => x._id===bookingId ? res.booking : x));
      if (res.slotWarning) {
        setAddServiceWarning(res.slotWarning);
      } else {
        setAddServiceBooking(null);
      }
    } catch (e) { setAddServiceErr(e.message); }
    finally { setAddServiceLoading(false); }
  };

  const markAddOnPaid = async (bookingId) => {
    try {
      const res = await api("PUT", `/bookings/${bookingId}/mark-addon-paid`);
      setBookings(bk => bk.map(x => x._id===bookingId ? res.booking : x));
    } catch (e) { /* silent — button stays visible to retry */ }
  };
  // Lets the socket refresh callback below always see the CURRENT tab
  // and date without needing to re-run the whole socket setup/teardown
  // (joining/leaving rooms, attaching listeners) every time either one
  // changes — the effect itself only depends on myStore/user, exactly
  // as it did before this was added.
  const slotsViewRef = useRef({ tab, gridDate: getISTDateString() });
  useEffect(() => { slotsViewRef.current = { tab, gridDate }; }, [tab, gridDate]);
  const [gridSlots, setGridSlots] = useState([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [slotBookings, setSlotBookings] = useState(null); // { time, bookings: [...] } | null

  // Reuses the same /bookings/slots endpoint customers use to see
  // availability — same source of truth for what counts as a slot,
  // what's blocked, what's on break. This deliberately does NOT
  // duplicate that generation logic on the frontend, since blocked
  // dates, break times, and capacity all live there already.
  const fetchGridSlots = async (date) => {
    if (!myStore) return;
    setGridLoading(true);
    try {
      const res = await api("GET", `/bookings/slots/${myStore._id}?date=${date}`);
      setGridSlots(res.slots || []);
    } catch (e) {
      setGridSlots([]);
    } finally {
      setGridLoading(false);
    }
  };

  useEffect(() => { if (tab === "slots" && myStore) fetchGridSlots(gridDate); }, [tab, gridDate, myStore]);

  // Fetched on-demand when the feed is opened, not automatically on
  // every dashboard load — this is a "check when I actually want to"
  // feed, not something worth an extra API call on every visit.
  const openActivity = async () => {
    setShowActivity(true);
    setActivityLoading(true);
    try {
      const res = await api("GET", `/bookings/store/${myStore._id}/activity`);
      setActivity(res.activity || []);
    } catch (e) {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const openCustomerHistory = async (name, phone) => {
    setCustomerHistory({ name, phone, bookings: [] });
    setCustomerHistoryLoading(true);
    try {
      const res = await api("GET", `/bookings/store/${myStore._id}/customer/${phone}`);
      setCustomerHistory({ name, phone, bookings: res.bookings || [] });
    } catch (e) {
      setCustomerHistory({ name, phone, bookings: [], error: e.message });
    } finally {
      setCustomerHistoryLoading(false);
    }
  };
  const [closingToday, setClosingToday] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeStatus, setCloseStatus] = useState(null); // { success, error }

  // Reuses the same addBlockedDate endpoint the Settings > Blocked Dates
  // form already calls — a whole-day block for today specifically, just
  // reachable in one tap from the Dashboard for a genuine emergency,
  // instead of navigating to Settings and filling out that form.
  const quickCloseToday = async () => {
    setClosingToday(true); setCloseStatus(null);
    try {
      await api("POST", "/bookings/store/blocked-dates", { date: today, slots: [], reason: closeReason.trim() || "Closed today" });
      setCloseStatus({ success:"Closed for the rest of today" });
      setTimeout(() => { setShowCloseConfirm(false); setCloseReason(""); setCloseStatus(null); }, 1600);
    } catch (e) {
      setCloseStatus({ error: e.message });
    } finally {
      setClosingToday(false);
    }
  };
  const [notifMsg, setNotifMsg] = useState(null); // { text, type } — small self-clearing banner feedback
  const [notifDismissed, setNotifDismissed] = useState(false);

  const handleEnableNotifications = async () => {
    const r = await enablePushNotifications();
    setNotifMsg({ text: r.message, type: r.success ? "success" : "error" });
    if (r.success) setNotifDismissed(true);
    setTimeout(() => setNotifMsg(null), 3500);
  };
  const [success,     setSuccess]     = useState("");
  const [locationSet, setLocationSet] = useState(false);
  const [form, setForm] = useState({
    name:"", category:"salon", phone:"", address:"", email:"",
    city:user.city||"", area:user.area||"", pincode:"", description:"",
    workingHours:{ open:"", close:"" },
  });
  const [services, setServices] = useState([{ name:"", price:0, duration:30 }]);
  const [regPhotos, setRegPhotos] = useState([]);
  const set   = (k,v) => setForm(f=>({...f,[k]:v}));
  const today = getISTDateString();

  const fetchMyStore = async () => {
    setLoading(true);
    try {
      const res = await api("GET", "/stores/owner/my-store");
      setMyStore(res.store);
      if (res.store) {
        const next7 = getNext7Days();
        const from7 = getISTDateString(next7[0]);
        const to7   = getISTDateString(next7[6]);
        const bRes = await api("GET", `/bookings/store/${res.store._id}?from=${from7}&to=${to7}`);
        setBookings(bRes.bookings||[]);
      }
    } catch(e) {
      if (e.message.includes("not registered")||e.message.includes("not found")) setMyStore(null);
    } finally { setLoading(false); }
  };

  const fetchHistory = async (store) => {
    setHistLoading(true);
    try {
      const to   = getISTDateString();
      const fromDate = getISTNow();
      fromDate.setUTCDate(fromDate.getUTCDate() - 30);
      const from = getISTDateString(fromDate);
      const res  = await api("GET", `/bookings/store/${store._id}?from=${from}&to=${to}`);
      setHistory(res.bookings||[]);
    } catch(e) { console.error(e); } finally { setHistLoading(false); }
  };

  // ── Payouts ──────────────────────────────────────────────────────────────
  const [payoutBalance,   setPayoutBalance]   = useState(0);
  const [payoutHistory,   setPayoutHistory]   = useState([]);
  const [payoutLoading,   setPayoutLoading]   = useState(false);
  const [payoutErr,       setPayoutErr]       = useState("");
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMsg,       setPayoutMsg]       = useState("");

  const fetchPayouts = async () => {
    setPayoutLoading(true); setPayoutErr("");
    try {
      const res = await api("GET", "/settlements/balance");
      setPayoutBalance(res.pendingBalance || 0);
      setPayoutHistory(res.history || []);
    } catch(e) { setPayoutErr(e.message); }
    finally { setPayoutLoading(false); }
  };

  const requestPayout = async () => {
    setRequestingPayout(true); setPayoutErr(""); setPayoutMsg("");
    try {
      await api("POST", "/settlements/request", {});
      setPayoutMsg("Payout requested! We'll transfer it to your account and update this page once it's done.");
      fetchPayouts();
    } catch(e) { setPayoutErr(e.message); }
    finally { setRequestingPayout(false); }
  };

  useEffect(() => { fetchMyStore(); }, []);
  useEffect(() => { if(tab==="history" && myStore) fetchHistory(myStore); }, [tab]);
  useEffect(() => { if(tab==="payouts") fetchPayouts(); }, [tab]);
  useEffect(() => { sessionStorage.setItem("sloty-owner-tab", tab); }, [tab]);
  useEffect(() => { if(myStore) fetchPayouts(); }, [myStore]); // also loads quietly on dashboard mount, for the summary banner

  // Real-time: join this owner's personal room (new bookings, anywhere)
  // and their store's today-queue room, so the dashboard updates the
  // instant a customer books — no need to wait for a manual refresh.
  // Plays Sloty's own chime while the dashboard tab is open.
  useEffect(() => {
    if (!myStore?._id) return;
    const socket = getSocket();
    const today = getISTDateString();
    joinRoom(`user:${user.id}`);
    joinRoom(`store:${myStore._id}:${today}`);

    const refresh = () => {
      const next7 = getNext7Days();
      const from7 = getISTDateString(next7[0]);
      const to7   = getISTDateString(next7[6]);
      api("GET", `/bookings/store/${myStore._id}?from=${from7}&to=${to7}`).then(r => setBookings(r.bookings||[])).catch(()=>{});
      // Also refresh the slots grid — but only if the owner is
      // actually looking at it right now, so a booking made while
      // they're on the Dashboard doesn't trigger a wasted fetch for a
      // tab that isn't even open.
      if (slotsViewRef.current.tab === "slots") fetchGridSlots(slotsViewRef.current.gridDate);
    };

    const onNewBooking = (payload) => {
      playChime();
      setBookings(prev => [...prev]); // trigger a refetch below
      refresh();
    };
    const onQueueUpdate = () => refresh();

    socket.on("booking:new", onNewBooking);
    socket.on("queue:update", onQueueUpdate);

    return () => {
      leaveRoom(`user:${user.id}`);
      leaveRoom(`store:${myStore._id}:${today}`);
      socket.off("booking:new", onNewBooking);
      socket.off("queue:update", onQueueUpdate);
    };
  }, [myStore?._id, user.id]);

  const registerStore = async () => {
    setErr(""); setSuccess("");
    if (!form.name)    return setErr("Store name is required");
    if (!form.phone)   return setErr("Phone number is required");
    if (!form.email || !form.email.trim()) return setErr("Please enter your email address");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErr("Enter a valid email address");
    if (!form.address) return setErr("Address is required");
    if (!form.city)    return setErr("Please select your store location");
    if (!form.workingHours.open||!form.workingHours.close) return setErr("Please set working hours");
    if (services.some(s=>!s.name||(!s.isPriceVariable && !s.price))) return setErr("Please fill all service details");
    if (regPhotos.length === 0) return setErr("Please add at least one photo of your store");
    try {
      const { lat, lng, ...formRest } = form;
      await api("POST", "/stores", { ...formRest, services, photos: regPhotos, location: { lat: lat ?? null, lng: lng ?? null } });
      setSuccess("Store registered! Waiting for admin approval.");
      setShowReg(false); fetchMyStore();
    } catch(e) { setErr(e.message); }
  };

  const toggleOpen = async () => {
    try {
      const res = await api("PUT", `/stores/${myStore._id}/toggle-open`);
      setMyStore(s=>({...s,isOpen:res.isOpen}));
    } catch(e) { setErr(e.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api("PUT", `/bookings/${id}/status`, {status});
      setBookings(b=>b.map(bk=>bk._id===id?{...bk,status}:bk));
    } catch(e) { setErr(e.message); }
  };

  const todayBookings = bookings.filter(b => b.date === today);
  // Includes paid add-ons — same reasoning as the History tab and
  // backend analytics: an add-on the store actually collected is real
  // revenue, not just the original booked price.
  const todayRevenue  = todayBookings.filter(b=>b.status==="completed").reduce((a,b)=>a+(b.service?.price||0)+(b.addedServicesPaymentStatus==="paid"?(b.addedServices||[]).reduce((s,x)=>s+(x.price||0),0):0),0);
  const waiting       = todayBookings.filter(b=>b.status==="confirmed").length;
  const inProgress    = todayBookings.filter(b=>b.status==="in_progress").length;
  const completed     = todayBookings.filter(b=>b.status==="completed").length;
  const queueBookings = staffFilter==="all" ? todayBookings : todayBookings.filter(b => b.staffId === staffFilter);

  // Primary four live in the fixed bottom nav (same component/pattern
  // as CustomerApp) — always visible, no scrolling. Everything else is
  // one tap away behind "More", rather than the old 10-wide horizontal
  // scroll strip where the last several tabs were only discoverable by
  // scrolling with nothing but a fade hint to suggest they existed.
  const MORE_TABS = [
    { key:"slots",     icon:CalendarDays, label:"Slots"     },
    { key:"offers",    icon:Tag,          label:"Offers"    },
    { key:"history",   icon:History,      label:"History"   },
    { key:"analytics", icon:BarChart3,    label:"Analytics" },
    { key:"payouts",   icon:Wallet,       label:"Payouts"   },
    { key:"settings",  icon:Settings,     label:"Settings"  },
  ];
  const isMoreTab = MORE_TABS.some(t => t.key === tab);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const OWNER_BOTTOM_TABS = [["","Dashboard","dashboard"],["","Queue","queue"],["","Bookings","bookings"],["","Messages","messages"],["","More","more"]];
  const onOwnerNavChange = (key) => {
    if (key === "more") { setShowMoreMenu(true); return; }
    setTab(key);
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, fontFamily:"'Nunito',sans-serif" }}>
      <Loader text="Loading your store..." />
    </div>
  );

  /* ── No store registered ── */
  if (!myStore) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif" }}>
      <div style={{ background:`linear-gradient(135deg,${C.sec},#2D1B4E)`, padding:"44px 20px 24px", borderBottomLeftRadius:28, borderBottomRightRadius:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:2 }}>OWNER DASHBOARD</p>
            <h2 style={{ fontSize:20, fontWeight:900, color:"#fff", marginTop:4 }}>Welcome, {user.name?.split(" ")[0]}</h2>
          </div>
          <button onClick={logout} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"8px 14px", color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>
      <div style={{ padding:20 }}>
        {success && <div style={{ background:C.green+"15", borderRadius:12, padding:14, marginBottom:16, display:"flex", gap:8, alignItems:"center" }}><CheckCircle size={16} color={C.green} /><p style={{ color:C.green, fontWeight:700 }}>{success}</p></div>}
        {!showReg ? (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <div style={{ width:88, height:88, borderRadius:28, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
              <Store size={40} color={C.pri} strokeWidth={1.5} />
            </div>
            <h3 style={{ fontSize:20, fontWeight:900, color:C.text }}>Register Your Store</h3>
            <p style={{ fontSize:13, color:C.muted, marginTop:8, marginBottom:24 }}>Add your store and start getting customers</p>
            <Btn onClick={() => setShowReg(true)}>Register My Store</Btn>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize:18, fontWeight:900, color:C.text, marginBottom:20 }}>Store Registration</h3>
            <Card>
              <SectionHeader icon={Store} title="Basic Info" />
              <Input label="Store Name" placeholder="e.g. Raja Hair Studio" value={form.name} onChange={e=>set("name",e.target.value)} />
              <Select label="Category" value={form.category} onChange={e=>set("category",e.target.value)}>
                {CATS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input label="Phone Number" placeholder="Store contact number" value={form.phone} onChange={e=>set("phone",e.target.value)} type="tel" />
              <Input label="Your Email" placeholder="your.email@example.com" value={form.email} onChange={e=>set("email",e.target.value)} type="email" />
              <p style={{ fontSize:10, color:C.muted, marginTop:-8, marginBottom:12 }}>Required — this is where booking notifications and approval updates will reach you.</p>
              <Input label="Full Address"  placeholder="Shop number, street name" value={form.address} onChange={e=>set("address",e.target.value)} />
              <Input label="Pincode"       placeholder="6-digit pincode"          value={form.pincode} onChange={e=>set("pincode",e.target.value)} />
            </Card>
            <Card>
              <SectionHeader icon={MapPin} title="Store Location" />
              <LocationDetector onDetected={loc=>{set("city",loc.city);set("area",loc.area);set("lat",loc.lat);set("lng",loc.lng);setLocationSet(true);}} />
              <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginBottom:8 }}>— or search your area —</p>
              <MapPicker initialCity={form.city} onSelect={loc=>{set("city",loc.city);set("area",loc.area);set("lat",loc.lat);set("lng",loc.lng);setLocationSet(true);}} />
              {locationSet && form.city && (
                <div style={{ background:C.green+"15", borderRadius:10, padding:"10px 14px", marginTop:6, display:"flex", gap:8, alignItems:"center" }}>
                  <CheckCircle size={14} color={C.green} />
                  <p style={{ fontSize:12, color:C.green, fontWeight:800 }}>{form.area&&`${form.area}, `}{form.city}</p>
                </div>
              )}
            </Card>
            <Card>
              <SectionHeader icon={Clock} title="Working Hours" />
              <div style={{ display:"flex", gap:10 }}>
                <TimeInput12h label="OPENS AT" value={form.workingHours.open} onChange={(v)=>set("workingHours",{...form.workingHours,open:v})} />
                <TimeInput12h label="CLOSES AT" value={form.workingHours.close} onChange={(v)=>set("workingHours",{...form.workingHours,close:v})} />
              </div>
            </Card>
            <Card>
              <SectionHeader icon={Wrench} title="Services Offered" />
              {services.map((s,i) => (
                <div key={i} style={{ background:C.inputBg, borderRadius:14, padding:12, marginBottom:10, border:"2px solid #E8ECF5" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <span style={{ fontSize:11, fontWeight:800, color:C.muted }}>SERVICE {i+1}</span>
                    {services.length > 1 && (
                      <button onClick={() => setServices(sv=>sv.filter((_,j)=>j!==i))} style={{ background:C.red+"15", color:C.red, border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
                        <Trash2 size={11} /> Remove
                      </button>
                    )}
                  </div>
                  <input value={s.name} onChange={e=>setServices(sv=>sv.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="e.g. Haircut, Oil Change..." style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontFamily:"'Nunito',sans-serif", marginBottom:10, boxSizing:"border-box", background:C.inputBg }} />
                  <div onClick={()=>setServices(sv=>sv.map((x,j)=>j===i?{...x,isPriceVariable:!x.isPriceVariable, price:!x.isPriceVariable?0:x.price}:x))} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, cursor:"pointer", padding:"8px 10px", background:s.isPriceVariable?C.acc+"15":"transparent", borderRadius:8 }}>
                    <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${s.isPriceVariable?C.acc:"#D0D4E0"}`, background:s.isPriceVariable?C.acc:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {s.isPriceVariable && <CheckCircle size={11} color="#fff" />}
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:s.isPriceVariable?"#92610A":C.muted }}>Variable pricing (price shown as "on inspection" — for services like PPF or repairs where price depends on the vehicle/parts needed)</span>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    {!s.isPriceVariable && (
                      <div style={{ flex:1 }}>
                        <label style={{ fontSize:10, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>PRICE (₹)</label>
                        <input value={s.price||""} onChange={e=>setServices(sv=>sv.map((x,j)=>j===i?{...x,price:Number(e.target.value)}:x))} onWheel={e=>e.target.blur()} placeholder="150" type="number" min="0" style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:14, fontWeight:800, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg, color:C.pri }} />
                      </div>
                    )}
                    <div style={{ flex:1 }}>
                      <label style={{ fontSize:10, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>DURATION (MIN)</label>
                      <input value={s.duration||""} onChange={e=>setServices(sv=>sv.map((x,j)=>j===i?{...x,duration:Number(e.target.value)}:x))} onWheel={e=>e.target.blur()} placeholder="30" type="number" min="5" step="5" style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:14, fontWeight:800, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg, color:C.blue }} />
                    </div>
                  </div>
                  <label style={{ fontSize:10, fontWeight:800, color:C.muted, display:"block", marginTop:10, marginBottom:5 }}>REMIND CUSTOMER TO REBOOK AFTER (DAYS) — OPTIONAL</label>
                  <input value={s.recurrenceDays||""} onChange={e=>setServices(sv=>sv.map((x,j)=>j===i?{...x,recurrenceDays:e.target.value?Number(e.target.value):null}:x))} onWheel={e=>e.target.blur()} placeholder="e.g. 30 for a monthly service" type="number" min="1" style={{ width:"100%", padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontWeight:700, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg, color:C.acc }} />
                </div>
              ))}
              <button onClick={() => setServices(sv=>[...sv,{name:"",price:0,duration:30,recurrenceDays:null}])} style={{ padding:"12px 20px", background:C.pri+"15", color:C.pri, border:`2px dashed ${C.pri}44`, borderRadius:12, cursor:"pointer", fontWeight:800, fontFamily:"'Nunito',sans-serif", fontSize:13, width:"100%", marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <Plus size={14} /> Add Another Service
              </button>
            </Card>
            <Card>
              <SectionHeader icon={ImageIcon} title="Store Photos" />
              <p style={{ fontSize:12, color:regPhotos.length===0?C.red:C.muted, fontWeight:regPhotos.length===0?700:400, marginTop:-8, marginBottom:12 }}>
                {regPhotos.length===0 ? "Required — add at least one photo of your store" : `${regPhotos.length} photo${regPhotos.length!==1?"s":""} added`}
              </p>
              <PhotoUploader photos={regPhotos} onChange={setRegPhotos} />
            </Card>
            {err && <div style={{ background:C.red+"15", borderRadius:12, padding:12, marginBottom:14, display:"flex", gap:8, alignItems:"center" }}><AlertCircle size={16} color={C.red} /><p style={{ color:C.red, fontSize:12, fontWeight:700 }}>{err}</p></div>}
            <div style={{ display:"flex", gap:10 }}>
              <Btn onClick={registerStore} color={C.green}>Submit for Approval</Btn>
              <Btn onClick={() => setShowReg(false)} color={C.red} outline>Cancel</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Pending approval — shows what was submitted, and lets the owner
     review/correct it while waiting, rather than leaving them with no
     visibility into their own submission. Reuses the exact same
     OwnerSettings component (and the exact same PUT /stores/:id save
     path) used for an already-approved store's Settings tab — editing
     a pending store works identically, nothing here needed to change
     to support it. ── */
  if (!myStore.isApproved) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif" }}>
      <div style={{ background:`linear-gradient(135deg,${C.sec},#2D1B4E)`, padding:"44px 20px 24px", borderBottomLeftRadius:28, borderBottomRightRadius:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <p style={{ fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:2 }}>OWNER DASHBOARD</p>
            <h2 style={{ fontSize:20, fontWeight:900, color:"#fff", marginTop:4 }}>Welcome, {user.name?.split(" ")[0]}</h2>
          </div>
          <button onClick={logout} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"8px 14px", color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
        <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:16, padding:"14px 16px", display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ width:44, height:44, borderRadius:14, background:C.acc+"25", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Timer size={22} color={C.acc} strokeWidth={1.8} />
          </div>
          <div>
            <p style={{ fontSize:14, fontWeight:900, color:"#fff" }}>Waiting for Approval</p>
            <p style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginTop:2 }}>You can review and edit your details below while you wait</p>
          </div>
        </div>
      </div>
      <div style={{ padding:20 }}>
        <OwnerSettings myStore={myStore} onUpdate={(updated) => setMyStore(updated)} user={user} />
      </div>
    </div>
  );

  /* ── Main Dashboard ── */
  const cat = getCat(myStore.category);
  const CatIcon = cat.Icon;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:20 }}>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${C.sec},#2D1B4E)`, padding:"44px 20px 20px", borderBottomLeftRadius:28, borderBottomRightRadius:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:48, height:48, borderRadius:16, background:cat.color+"33", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <CatIcon size={24} color={cat.color} strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:2 }}>OWNER DASHBOARD</p>
              <h2 style={{ fontSize:18, fontWeight:900, color:"#fff", marginTop:2 }}>{myStore.name}</h2>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                <MapPin size={11} color="rgba(255,255,255,0.4)" />
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{myStore.area&&`${myStore.area}, `}{myStore.city}</p>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
            <button onClick={toggleOpen} style={{ background:myStore.isOpen?C.green+"22":C.red+"22", color:myStore.isOpen?C.green:C.red, border:`2px solid ${myStore.isOpen?C.green:C.red}33`, borderRadius:10, padding:"7px 14px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
              <Circle size={8} color={myStore.isOpen?C.green:C.red} fill={myStore.isOpen?C.green:C.red} />
              {myStore.isOpen?"Open":"Closed"}
            </button>
            <button onClick={logout} style={{ background:"transparent", color:"rgba(255,255,255,0.3)", border:"none", fontSize:11, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
              <LogOut size={11} /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Shown only while inside a "More" screen — the bottom nav no
          longer has a highlighted item for these, so this gives back
          both orientation (which section is this?) and a one-tap way
          out, instead of the old tab strip's always-visible labels. */}
      {isMoreTab && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", background:C.card, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
          <button onClick={() => setTab("dashboard")} style={{ background:"none", border:"none", padding:4, cursor:"pointer", display:"flex", alignItems:"center" }}>
            <ArrowLeft size={18} color={C.muted} />
          </button>
          <span style={{ fontSize:14, fontWeight:800, color:C.text }}>{MORE_TABS.find(t => t.key === tab)?.label}</span>
        </div>
      )}

      <div style={{ padding:"16px 16px 100px" }}>

        {/* ── Dashboard ── */}
        {tab==="dashboard" && (
          <div>
            {!notifDismissed && (
              <div style={{ background:`linear-gradient(135deg,${C.pri}12,${C.pri}06)`, border:`1.5px solid ${C.pri}28`, borderRadius:16, padding:"14px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:12, background:C.pri+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Bell size={18} color={C.pri} />
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:800, color:C.text }}>Get notified instantly</p>
                  <p style={{ fontSize:11, color:C.muted }}>Know the moment a customer books — even with the app closed</p>
                </div>
                <button onClick={handleEnableNotifications} style={{ padding:"8px 14px", background:C.pri, color:"#fff", border:"none", borderRadius:10, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif", flexShrink:0 }}>Enable</button>
                <button onClick={() => setNotifDismissed(true)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, padding:4, flexShrink:0 }}><X size={16} /></button>
              </div>
            )}
            {notifMsg && (
              <div style={{ background: notifMsg.type==="success" ? C.green+"15" : C.red+"15", borderRadius:12, padding:"10px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                {notifMsg.type==="success" ? <CheckCircle size={15} color={C.green} /> : <AlertCircle size={15} color={C.red} />}
                <span style={{ fontSize:12, fontWeight:700, color: notifMsg.type==="success" ? C.green : C.red }}>{notifMsg.text}</span>
              </div>
            )}
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <button onClick={() => setShowCloseConfirm(true)} style={{ flex:1, padding:"12px", background:C.red+"10", color:C.red, border:`1.5px dashed ${C.red}44`, borderRadius:14, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <Ban size={13} /> Close Today
              </button>
              <button onClick={openActivity} style={{ flex:1, padding:"12px", background:C.pri+"10", color:C.pri, border:`1.5px solid ${C.pri}33`, borderRadius:14, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <Bell size={13} /> Recent Activity
              </button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:20 }}>
              <StatCard icon={CalendarDays}  value={todayBookings.length} label="Today's Bookings" color={C.blue}  onClick={() => setTab("bookings")} />
              <StatCard icon={CheckCircle}   value={completed}       label="Completed"         color={C.green} onClick={() => setTab("history")} />
              <StatCard icon={Users}         value={waiting}         label="Waiting"           color={C.red}   onClick={() => setTab("queue")} />
              <StatCard icon={IndianRupee}   value={`₹${todayRevenue}`} label="Revenue"       color={C.acc}   onClick={() => setTab("history")} />
            </div>

            {payoutBalance > 0 && (
              <div onClick={() => setTab("payouts")} style={{ background:`linear-gradient(100deg,${C.pri},#DB2777)`, borderRadius:16, padding:16, marginBottom:20, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.8)", fontWeight:700, marginBottom:2 }}>Available to withdraw (UPI payments)</p>
                  <p style={{ fontSize:22, fontWeight:900, color:"#fff" }}>₹{payoutBalance}</p>
                </div>
                <div style={{ background:"rgba(255,255,255,0.2)", borderRadius:12, padding:"8px 16px", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:"#fff" }}>Withdraw</span>
                  <ChevronRight size={14} color="#fff" />
                </div>
              </div>
            )}

            <Card>
              <SectionHeader icon={ListOrdered} title="Up Next in Queue" />
              {(() => {
                // Converts "10:30 AM" style strings to minutes-since-midnight
                // so bookings sort correctly by actual time, not alphabetically
                // (plain string sort would put "2:00 PM" before "10:30 AM").
                const toMinutes = (t) => {
                  const [time, period] = t.split(" ");
                  let [h, m] = time.split(":").map(Number);
                  if (period === "PM" && h !== 12) h += 12;
                  if (period === "AM" && h === 12) h = 0;
                  return h * 60 + m;
                };
                const tomorrow = getISTDateString(getNext7Days()[1]);
                const upNext = bookings
                  .filter(b => b.status === "confirmed")
                  .sort((a,b) => a.date === b.date ? toMinutes(a.timeSlot) - toMinutes(b.timeSlot) : a.date.localeCompare(b.date))
                  .slice(0,3);
                if (upNext.length === 0) return (
                  <div style={{ textAlign:"center", padding:"20px 0" }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:C.green+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px" }}><CheckCircle size={20} color={C.green} /></div>
                    <p style={{ color:C.muted, fontSize:13, fontWeight:700 }}>No upcoming bookings in the next 7 days</p>
                  </div>
                );
                return upNext.map((b,i) => {
                  const dateLabel = b.date === today ? null : b.date === tomorrow ? "Tomorrow" : new Date(b.date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
                  return (
                    <div key={b._id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom:i<upNext.length-1?"1px solid #F0F2F8":"none" }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <div style={{ background:`linear-gradient(135deg,${C.sec},#2D1B4E)`, borderRadius:10, padding:"5px 12px", minWidth:40, textAlign:"center" }}>
                          <span style={{ color:"#fff", fontWeight:900, fontSize:13 }}>{b.tokenNumber}</span>
                        </div>
                        <div>
                          <p style={{ fontSize:13, fontWeight:800, color:C.text }}>{b.customerName}</p>
                          <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                            <Clock size={11} color={C.muted} />
                            <p style={{ fontSize:11, color:C.muted }}>
                              {dateLabel && <span style={{ color:C.pri, fontWeight:800 }}>{dateLabel} · </span>}
                              {b.timeSlot} · {b.service?.name}{b.staffName?` · ${b.staffName}`:""}
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* OTP verification only makes sense once the customer has
                          actually arrived — meaningless for a booking that's still
                          days away, so this button only shows for today's entries. */}
                      {!dateLabel && (
                        <button onClick={() => setTab("queue")} style={{ background:C.pri+"15", color:C.pri, border:`1.5px solid ${C.pri}33`, borderRadius:8, padding:"7px 12px", fontWeight:800, cursor:"pointer", fontSize:11, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
                          <ShieldCheck size={12} /> Verify OTP
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </Card>
          </div>
        )}

        {/* ── Queue ── */}
        {tab==="queue" && (
          <div>
            {myStore.hasStaff && myStore.staff?.filter(s=>s.isActive).length > 0 && (
              <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:12, scrollbarWidth:"none" }}>
                <button onClick={() => setStaffFilter("all")} style={{ flexShrink:0, padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer", background:staffFilter==="all"?C.pri:"#fff", color:staffFilter==="all"?"#fff":C.muted, fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                  All Staff
                </button>
                {myStore.staff.filter(s=>s.isActive).map(s => (
                  <button key={s._id} onClick={() => setStaffFilter(s._id)} style={{ flexShrink:0, padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer", background:staffFilter===s._id?C.pri:"#fff", color:staffFilter===s._id?"#fff":C.muted, fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              {[
                [Users,       waiting,    "Waiting",     C.red],
                [PlayCircle,  inProgress, "In Progress", C.acc],
                [CheckCircle, completed,  "Done",        C.green],
              ].map(([Icon,v,l,col]) => (
                <div key={l} style={{ flex:1, background:C.card, borderRadius:14, padding:"12px 8px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ display:"flex", justifyContent:"center", marginBottom:4 }}><Icon size={16} color={col} /></div>
                  <div style={{ fontSize:20, fontWeight:900, color:col }}>{v}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            {queueBookings.length===0 ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ width:56, height:56, borderRadius:18, background:C.green+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}><CheckCircle size={24} color={C.green} /></div>
                <p style={{ color:C.muted, fontSize:14, fontWeight:700 }}>No bookings today yet</p>
              </div>
            ) : queueBookings.map(b => (
              <Card key={b._id}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ background:b.status==="completed"?C.green:b.status==="in_progress"?C.pri:C.sec, borderRadius:10, padding:"5px 12px" }}>
                      <span style={{ color:"#fff", fontWeight:900, fontSize:14 }}>{b.tokenNumber}</span>
                    </div>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <p onClick={()=>openCustomerHistory(b.customerName, b.customerPhone)} style={{ fontSize:14, fontWeight:800, color:C.text, cursor:"pointer" }}>{b.customerName}</p>
                        {b.customerVisitCount > 1 && (
                          <span style={{ fontSize:9, fontWeight:800, color:C.acc, background:C.acc+"18", padding:"2px 7px", borderRadius:8 }}>{ordinal(b.customerVisitCount)} visit</span>
                        )}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                        <Phone size={11} color={C.muted} />
                        <p style={{ fontSize:11, color:C.muted }}>{b.customerPhone}</p>
                      </div>
                    </div>
                  </div>
                  <Badge color={b.status==="completed"?C.green:b.status==="in_progress"?C.pri:b.status==="confirmed"?C.blue:b.status==="cancelled"?C.red:b.status==="no_show"?C.red:C.acc} text={b.status.replace("_"," ")} />
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}><Wrench size={12} color={C.muted} /><span style={{ fontSize:12, color:C.muted }}>{b.service?.name}</span></div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}><Clock size={12} color={C.muted} /><span style={{ fontSize:12, color:C.muted }}>{b.timeSlot}</span></div>
                  {b.staffName && (
                    <div style={{ display:"flex", alignItems:"center", gap:4, background:C.pri+"12", padding:"2px 8px", borderRadius:10 }}>
                      <Users size={11} color={C.pri} />
                      <span style={{ fontSize:11, color:C.pri, fontWeight:700 }}>{b.staffName}</span>
                    </div>
                  )}
                  {b.paymentMode === "upi" && b.paymentStatus === "paid" && (
                    <div style={{ display:"flex", alignItems:"center", gap:4, background:C.green+"12", padding:"2px 8px", borderRadius:10 }}>
                      <CheckCircle size={11} color={C.green} />
                      <span style={{ fontSize:11, color:C.green, fontWeight:800 }}>Paid via UPI</span>
                    </div>
                  )}
                  <div style={{ display:"flex", alignItems:"center", gap:2, marginLeft:"auto" }}><IndianRupee size={12} color={C.pri} strokeWidth={2.5} /><span style={{ fontSize:13, fontWeight:900, color:C.pri }}>{b.service?.price}</span></div>
                </div>

                {b.status==="confirmed" && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <input
                        placeholder="– – – –"
                        maxLength={4}
                        inputMode="numeric"
                        id={`otp-${b._id}`}
                        className="owner-otp-input"
                        style={{ flex:1, padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:18, fontWeight:900, fontFamily:"'Nunito',sans-serif", letterSpacing:6, textAlign:"center", background:C.inputBg }}
                      />
                      <button onClick={async () => {
                        const otpVal = document.getElementById(`otp-${b._id}`).value;
                        if (!otpVal || otpVal.length !== 4) { setOtpErr(e=>({...e,[b._id]:"Enter a valid 4-digit OTP"})); return; }
                        setOtpErr(e=>({...e,[b._id]:""}));
                        try {
                          await api("PUT", `/bookings/${b._id}/verify-otp`, { otp: otpVal });
                          setBookings(bk => bk.map(x => x._id===b._id ? {...x, status:"in_progress", otpVerified:true} : x));
                        } catch(e) { setOtpErr(er=>({...er,[b._id]:e.message})); }
                      }} style={{ padding:"11px 16px", background:`linear-gradient(135deg,${C.green},#00A887)`, color:"#fff", border:"none", borderRadius:10, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
                        <ShieldCheck size={15} /> Verify
                      </button>
                    </div>
                    {otpErr[b._id] && (
                      <p style={{ color: C.red, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>⚠️ {otpErr[b._id]}</p>
                    )}
                    <button onClick={()=>updateStatus(b._id,"no_show")} style={{ width:"100%", padding:"10px", background:C.red+"15", color:C.red, border:`1.5px solid ${C.red}33`, borderRadius:10, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                      <XCircle size={14} /> Mark No Show
                    </button>
                  </div>
                )}

                {b.status==="in_progress" && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ background:C.green+"15", borderRadius:10, padding:"8px 12px", marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
                      <ShieldCheck size={14} color={C.green} />
                      <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>OTP Verified — Service in progress</span>
                    </div>
                    <button onClick={()=>updateStatus(b._id,"completed")} style={{ width:"100%", padding:"11px", background:`linear-gradient(135deg,${C.green},#00A887)`, color:"#fff", border:"none", borderRadius:11, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                      <CheckCircle size={15} /> Mark Complete
                    </button>
                  </div>
                )}

                {(b.status==="confirmed" || b.status==="in_progress") && (
                  <button onClick={()=>{setAddServiceBooking(b); setAddServiceErr(""); setAddServiceWarning("");}} style={{ width:"100%", padding:"9px", marginTop:8, background:C.acc+"15", color:"#B8860B", border:`1.5px dashed ${C.acc}`, borderRadius:10, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    <Plus size={13} /> Add Service
                  </button>
                )}

                {b.addedServices?.length > 0 && (
                  <div style={{ marginTop:10, background:C.inputBg, borderRadius:10, padding:"10px 12px" }}>
                    <p style={{ fontSize:11, fontWeight:800, color:C.muted, marginBottom:6 }}>ADDED DURING VISIT</p>
                    {b.addedServices.map((s,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.text, marginBottom:2 }}>
                        <span>{s.name}</span>
                        <span style={{ fontWeight:800 }}>₹{s.price}</span>
                      </div>
                    ))}
                    {b.addedServicesPaymentStatus === "paid" ? (
                      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:6 }}>
                        <CheckCircle size={11} color={C.green} />
                        <span style={{ fontSize:11, color:C.green, fontWeight:800 }}>Add-on paid</span>
                      </div>
                    ) : (
                      <button onClick={()=>markAddOnPaid(b._id)} style={{ width:"100%", padding:"7px", marginTop:6, background:C.green+"15", color:C.green, border:"none", borderRadius:8, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:11 }}>
                        Mark Add-on as Paid
                      </button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ── Bookings ── */}
        {tab==="bookings" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h3 style={{ fontSize:16, fontWeight:900, color:C.text }}>Upcoming Bookings</h3>
              <span style={{ fontSize:12, color:C.muted }}>Next 7 days</span>
            </div>
            <div style={{ background:C.card, borderRadius:14, padding:"10px 14px", display:"flex", gap:8, alignItems:"center", marginBottom:14, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
              <Search size={15} color={C.muted} />
              <input value={bookingSearch} onChange={e=>setBookingSearch(e.target.value)} placeholder="Search by customer name or phone..." style={{ flex:1, border:"none", fontSize:13, outline:"none", background:"transparent", fontFamily:"'Nunito',sans-serif" }} />
              {bookingSearch && <div onClick={()=>setBookingSearch("")} style={{ cursor:"pointer", display:"flex" }}><X size={14} color={C.muted} /></div>}
            </div>
            {(() => {
              const q = bookingSearch.trim().toLowerCase();
              const visibleBookings = q ? bookings.filter(b => (b.customerName||"").toLowerCase().includes(q) || (b.customerPhone||"").includes(q)) : bookings;
              if (visibleBookings.length === 0) return (
                <div style={{ textAlign:"center", padding:"40px 0" }}>
                  <div style={{ width:56, height:56, borderRadius:18, background:C.blue+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}><CalendarDays size={24} color={C.blue} /></div>
                  <p style={{ color:C.muted, fontWeight:700 }}>{q ? "No bookings match your search" : "No upcoming bookings"}</p>
                </div>
              );
              const tomorrow = getISTDateString(getNext7Days()[1]);
              const byDate = visibleBookings.reduce((acc, b) => {
                if (!acc[b.date]) acc[b.date] = [];
                acc[b.date].push(b);
                return acc;
              }, {});
              return Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, dayBookings]) => (
                <div key={date} style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <CalendarDays size={13} color={C.pri} />
                    <span style={{ fontSize:13, fontWeight:900, color:C.text }}>
                      {date === today ? "Today" : date === tomorrow ? "Tomorrow" : new Date(date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}
                    </span>
                    <span style={{ fontSize:11, color:C.muted }}>· {dayBookings.length} booking{dayBookings.length>1?"s":""}</span>
                    <div style={{ flex:1, height:1, background:"#E8ECF5" }} />
                  </div>
                  {dayBookings.map(b => (
              <Card key={b._id}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ background:C.sec, borderRadius:8, padding:"4px 10px" }}>
                      <span style={{ color:"#fff", fontWeight:900, fontSize:13 }}>{b.tokenNumber}</span>
                    </div>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <p onClick={()=>openCustomerHistory(b.customerName, b.customerPhone)} style={{ fontSize:14, fontWeight:800, color:C.text, cursor:"pointer" }}>{b.customerName}</p>
                        {b.customerVisitCount > 1 && (
                          <span style={{ fontSize:9, fontWeight:800, color:C.acc, background:C.acc+"18", padding:"2px 7px", borderRadius:8 }}>{ordinal(b.customerVisitCount)} visit</span>
                        )}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                        <Phone size={11} color={C.muted} />
                        <p style={{ fontSize:11, color:C.muted }}>{b.customerPhone}</p>
                      </div>
                    </div>
                  </div>
                  <Badge color={b.status==="completed"?C.green:b.status==="in_progress"?C.pri:b.status==="confirmed"?C.blue:b.status==="cancelled"?C.red:b.status==="no_show"?C.red:C.acc} text={b.status.replace("_"," ")} />
                </div>
                {b.status==="cancelled" && b.cancelReason && (
                  <p style={{ fontSize:11, color:C.red, fontStyle:"italic", marginBottom:8 }}>Cancelled: "{b.cancelReason}"</p>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}><Wrench size={11} color={C.muted} /><span style={{ fontSize:12, color:C.muted }}>{b.service?.name}</span></div>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}><Clock size={11} color={C.muted} /><span style={{ fontSize:12, color:C.muted }}>{b.timeSlot}</span></div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {b.paymentMode === "upi" && b.paymentStatus === "paid" && (
                        <span style={{ fontSize:10, color:C.green, fontWeight:800 }}>UPI ✓</span>
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:1 }}><IndianRupee size={12} color={C.pri} strokeWidth={2.5} /><span style={{ fontSize:13, fontWeight:900, color:C.pri }}>{b.service?.price}</span></div>
                    </div>
                    {b.addedServices?.length > 0 && (
                      <p style={{ fontSize:9, color:"#B8860B", fontWeight:700 }}>+₹{b.addedServices.reduce((s,x)=>s+(x.price||0),0)} add-on</p>
                    )}
                  </div>
                </div>
              </Card>
                  ))}
                </div>
              ));
            })()}
            {bookings.length>0 && (
              <div style={{ background:`linear-gradient(135deg,${C.sec},#2D1B4E)`, borderRadius:18, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <TrendingUp size={18} color={C.acc} />
                  <span style={{ fontSize:14, fontWeight:800, color:"rgba(255,255,255,0.7)" }}>Today's Revenue</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:2 }}>
                  <IndianRupee size={16} color={C.acc} strokeWidth={2.5} />
                  <span style={{ fontSize:22, fontWeight:900, color:C.acc }}>{todayRevenue}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Slots ── */}
        {tab==="slots" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h3 style={{ fontSize:16, fontWeight:900, color:C.text }}>Slots</h3>
              <span style={{ fontSize:12, color:C.muted }}>Tap a slot to see who's booked</span>
            </div>

            <button onClick={() => setShowManageSlots(true)} style={{ width:"100%", padding:"12px", marginBottom:16, background:C.pri+"10", color:C.pri, border:`1.5px solid ${C.pri}33`, borderRadius:14, fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Settings size={14} /> Manage Slots — Blocked Dates & Break Times
            </button>

            {/* Date selector — next 7 days, matching the same window
                the Bookings tab already fetches, so switching dates
                here never needs a separate range fetch. */}
            <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:16, paddingBottom:4, scrollbarWidth:"none" }}>
              {getNext7Days().map(d => {
                const dateStr = getISTDateString(d);
                const isSelected = dateStr === gridDate;
                const isToday = dateStr === today;
                return (
                  <button key={dateStr} onClick={() => setGridDate(dateStr)} style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"10px 14px", borderRadius:14, border:`2px solid ${isSelected?C.pri:"#E8ECF5"}`, background:isSelected?C.pri:"#fff", cursor:"pointer", fontFamily:"'Nunito',sans-serif", minWidth:56 }}>
                    <span style={{ fontSize:10, fontWeight:800, color:isSelected?"#fff":C.muted }}>{isToday ? "TODAY" : d.toLocaleDateString("en-IN",{weekday:"short"}).toUpperCase()}</span>
                    <span style={{ fontSize:15, fontWeight:900, color:isSelected?"#fff":C.text }}>{d.getDate()}</span>
                  </button>
                );
              })}
            </div>

            {gridLoading ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}><Loader /></div>
            ) : gridSlots.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <p style={{ color:C.muted, fontWeight:700 }}>No slots configured for this day</p>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
                {gridSlots.map(slot => {
                  // Grid interval — the gap between consecutive slot
                  // times (e.g. 30 min) — used below to give each grid
                  // cell a real start/end range, not just a single point
                  // in time.
                  const gridIntervalMin = gridSlots.length > 1
                    ? slotTimeToMinutes(gridSlots[1].time) - slotTimeToMinutes(gridSlots[0].time)
                    : 30;
                  const slotStart = slotTimeToMinutes(slot.time);
                  const slotEnd = slotStart + gridIntervalMin;

                  // Real overlap check, not exact-string matching — a
                  // 60-minute service booked at 9:00 AM genuinely
                  // occupies the 9:30 grid cell too, even though that
                  // booking's own timeSlot field only ever says "9:00
                  // AM". This is exactly what was making some booked
                  // slots silently look Open, and taps on them show
                  // nothing — this fixes both at the source.
                  //
                  // Only "confirmed"/"in_progress" actually hold the
                  // slot — same rule the backend's own availability
                  // check uses. Excluding just "cancelled" (as this used
                  // to) left completed and no-show bookings still
                  // showing their slot as booked/red forever, even
                  // though the slot is genuinely free again the moment
                  // the customer's done or didn't show — confirmed live
                  // by completing one booking and no-showing another and
                  // watching both stay stuck red here.
                  const slotBookingsHere = bookings.filter(b => {
                    if (b.date !== gridDate || !["confirmed","in_progress"].includes(b.status)) return false;
                    const bStart = slotTimeToMinutes(b.timeSlot);
                    const bEnd = bStart + (b.service?.duration || gridIntervalMin);
                    return bStart < slotEnd && bEnd > slotStart;
                  });
                  // Backend's own isBooked flag (from the same overlap
                  // logic, server-side) is trusted as the primary
                  // signal — the cross-reference above is now just as
                  // accurate, but keeping both means a mismatch would
                  // still show the slot as booked with a fallback
                  // message, rather than silently looking like Open.
                  const isBooked = slot.isBooked || slotBookingsHere.length > 0;
                  const bg = slot.isBlocked || slot.isBreak ? "#F0F2F8" : isBooked ? C.red+"12" : C.green+"12";
                  const border = slot.isBlocked || slot.isBreak ? "#E8ECF5" : isBooked ? C.red+"33" : C.green+"33";
                  const textColor = slot.isBlocked || slot.isBreak ? C.muted : isBooked ? C.red : C.green;
                  return (
                    <button
                      key={slot.time}
                      onClick={() => isBooked && setSlotBookings({ time: slot.time, bookings: slotBookingsHere })}
                      style={{ padding:"10px 6px", borderRadius:12, border:`1.5px solid ${border}`, background:bg, cursor:isBooked?"pointer":"default", fontFamily:"'Nunito',sans-serif", textAlign:"center" }}
                    >
                      <p style={{ fontSize:12, fontWeight:800, color:textColor, marginBottom:2 }}>{slot.time}</p>
                      <p style={{ fontSize:9, fontWeight:700, color:textColor }}>
                        {slot.isBlocked ? "Blocked" : slot.isBreak ? "Break" : isBooked ? (slotBookingsHere.length ? `${slotBookingsHere.length} booked` : "Booked") : "Open"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Offers ── */}
        {tab==="offers" && <Suspense fallback={<Loader text="Loading offers..." />}><OwnerOffers services={myStore?.services} /></Suspense>}

        {/* ── Messages ── */}
        {tab==="messages" && <Suspense fallback={<Loader text="Loading messages..." />}><OwnerMessages activeId={activeConversationId} setActiveId={setActiveConversationId} /></Suspense>}

        {/* ── History ── */}
        {tab==="history" && (
          <div>
            {histLoading ? <Loader text="Loading history..." /> : (() => {
              // Same reasoning as the backend analytics fix — a paid
              // add-on is real revenue the store actually collected,
              // and should count here too, not just the original price.
              const bookingTotal = (b) => (b.service?.price || 0) + (b.addedServicesPaymentStatus === "paid" ? (b.addedServices || []).reduce((s,x)=>s+(x.price||0),0) : 0);
              const completed30  = history.filter(b=>b.status==="completed");
              const cancelled30  = history.filter(b=>b.status==="cancelled");
              const revenue30    = completed30.reduce((s,b)=>s+bookingTotal(b),0);
              const byDate = history.reduce((acc,b) => {
                if (!acc[b.date]) acc[b.date] = [];
                acc[b.date].push(b);
                return acc;
              }, {});
              return (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:20 }}>
                    <StatCard icon={CalendarDays} value={history.length}      label="Total Bookings"  color={C.blue}  />
                    <StatCard icon={CheckCircle}  value={completed30.length}  label="Completed"       color={C.green} />
                    <StatCard icon={XCircle}      value={cancelled30.length}  label="Cancelled"       color={C.red}   />
                    <StatCard icon={TrendingUp}   value={`₹${revenue30}`}    label="30-Day Revenue"  color={C.acc}   />
                  </div>
                  <h3 style={{ fontSize:15, fontWeight:900, color:C.text, marginBottom:12 }}>Last 30 Days</h3>
                  {Object.keys(byDate).length===0 ? (
                    <div style={{ textAlign:"center", padding:"40px 0" }}>
                      <div style={{ width:56, height:56, borderRadius:18, background:C.blue+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}><History size={24} color={C.blue} /></div>
                      <p style={{ color:C.muted, fontWeight:700 }}>No bookings in last 30 days</p>
                    </div>
                  ) : Object.entries(byDate).map(([date, dayBookings]) => {
                    const dayRevenue = dayBookings.filter(b=>b.status==="completed").reduce((s,b)=>s+bookingTotal(b),0);
                    return (
                      <Card key={date} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ width:36, height:36, borderRadius:11, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <CalendarDays size={16} color={C.pri} />
                            </div>
                            <div>
                              <p style={{ fontSize:13, fontWeight:900, color:C.text }}>{new Date(date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</p>
                              <p style={{ fontSize:11, color:C.muted }}>{dayBookings.length} bookings · {dayBookings.filter(b=>b.status==="completed").length} done</p>
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:1 }}><IndianRupee size={14} color={C.green} strokeWidth={2.5} /><span style={{ fontSize:16, fontWeight:900, color:C.green }}>{dayRevenue}</span></div>
                        </div>
                        {dayBookings.map((b,i) => (
                          <div key={b._id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderTop:"1px solid #F0F2F8" }}>
                            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                              <span style={{ fontSize:11, background:C.sec, color:"#fff", borderRadius:6, padding:"2px 8px", fontWeight:800 }}>{b.tokenNumber}</span>
                              <div>
                                <p style={{ fontSize:12, fontWeight:700, color:C.text }}>{b.customerName}</p>
                                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                                  <Wrench size={10} color={C.muted} /><span style={{ fontSize:10, color:C.muted }}>{b.service?.name}</span>
                                  <Clock size={10} color={C.muted} /><span style={{ fontSize:10, color:C.muted }}>{b.timeSlot}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:1, justifyContent:"flex-end" }}><IndianRupee size={11} color={C.pri} strokeWidth={2.5} /><span style={{ fontSize:12, fontWeight:900, color:C.pri }}>{b.service?.price}</span></div>
                              {b.addedServices?.length > 0 && (
                                <p style={{ fontSize:9, color:"#B8860B", fontWeight:700, marginTop:1 }}>+₹{b.addedServices.reduce((s,x)=>s+(x.price||0),0)} add-on</p>
                              )}
                              <div style={{ display:"flex", alignItems:"center", gap:4, justifyContent:"flex-end" }}>
                                {b.paymentMode === "upi" && b.paymentStatus === "paid" && <span style={{ fontSize:9, color:C.green, fontWeight:800 }}>UPI</span>}
                                <span style={{ fontSize:10, color:b.status==="completed"?C.green:b.status==="cancelled"?C.red:C.muted, fontWeight:700 }}>{b.status}</span>
                              </div>
                              {b.status === "cancelled" && b.cancelReason && (
                                <p style={{ fontSize:9, color:C.muted, marginTop:2, maxWidth:120, textAlign:"right" }}>"{b.cancelReason}"</p>
                              )}
                              {b.status === "cancelled" && b.refundStatus === "refunded_to_wallet" && (
                                <p style={{ fontSize:9, color:C.green, marginTop:2, fontWeight:700 }}>₹{b.refundAmount} refunded to wallet</p>
                              )}
                              {b.status === "cancelled" && b.refundStatus === "forfeited" && (
                                <p style={{ fontSize:9, color:C.muted, marginTop:2, fontWeight:700 }}>Payment forfeited (late cancellation)</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </Card>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}

        {tab==="analytics" && <Suspense fallback={<Loader text="Loading analytics..." />}><OwnerAnalytics /></Suspense>}

        {tab==="payouts" && (
          <div style={{ padding:20 }}>
            <Card>
              <div style={{ textAlign:"center", padding:"12px 0" }}>
                <div style={{ width:56, height:56, borderRadius:"50%", background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
                  <Wallet size={26} color={C.pri} />
                </div>
                <p style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:4 }}>Available to withdraw</p>
                <p style={{ fontSize:32, fontWeight:900, color:C.text, marginBottom:16 }}>₹{payoutLoading ? "..." : payoutBalance}</p>

                {payoutMsg && <p style={{ color:C.green, fontSize:12, fontWeight:700, marginBottom:12 }}>{payoutMsg}</p>}
                {payoutErr && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginBottom:12 }}>{payoutErr}</p>}

                <Btn onClick={requestPayout} disabled={requestingPayout || payoutBalance <= 0 || payoutHistory.some(h=>h.status==="requested")}>
                  {requestingPayout ? "Requesting..." : payoutHistory.some(h=>h.status==="requested") ? "Payout Already Requested" : payoutBalance <= 0 ? "Nothing to Withdraw Yet" : "Request Payout"}
                </Btn>
                <p style={{ fontSize:10, color:C.muted, marginTop:10, lineHeight:1.5 }}>
                  This is UPI revenue collected through the app on your behalf. Requesting a payout notifies us to transfer it to your bank account — this may take 1-2 business days.
                </p>
              </div>
            </Card>

            <Card>
              <SectionHeader icon={History} title="Payout History" />
              {payoutHistory.length === 0 ? (
                <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"16px 0" }}>No payout requests yet.</p>
              ) : payoutHistory.map(h => (
                <div key={h._id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:"1px solid #F0F2F8" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:1 }}>
                      <IndianRupee size={12} color={C.text} strokeWidth={2.5} />
                      <span style={{ fontSize:14, fontWeight:800, color:C.text }}>{h.amount}</span>
                    </div>
                    <p style={{ fontSize:10, color:C.muted, marginTop:2 }}>{new Date(h.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}</p>
                  </div>
                  <Badge color={h.status==="completed"?C.green:C.acc} text={h.status==="completed"?"Paid Out":"Requested"} />
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="settings" && <OwnerSettings myStore={myStore} onUpdate={(updated) => setMyStore(updated)} user={user} />}
      </div>

      <BottomSheet open={showCloseConfirm} onClose={() => { setShowCloseConfirm(false); setCloseStatus(null); }} title="Close for the rest of today?">
        {closeStatus?.success ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <CheckCircle size={36} color={C.green} />
            <p style={{ fontSize:14, fontWeight:800, color:C.green, marginTop:10 }}>{closeStatus.success}</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize:13, color:C.muted, marginBottom:16, lineHeight:1.5 }}>
              This blocks all remaining slots today — existing customer bookings aren't affected, but no new bookings can be made for the rest of today.
            </p>
            <Input label="Reason (optional)" placeholder="e.g. Emergency, unwell" value={closeReason} onChange={e=>setCloseReason(e.target.value)} />
            {closeStatus?.error && (
              <div style={{ background:C.red+"12", border:`1.5px solid ${C.red}33`, borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", gap:8, alignItems:"center" }}>
                <AlertCircle size={14} color={C.red} />
                <p style={{ color:C.red, fontSize:12, fontWeight:700 }}>{closeStatus.error}</p>
              </div>
            )}
            <Btn onClick={quickCloseToday} disabled={closingToday} color={C.red}>
              {closingToday ? "Closing..." : "Close for Today"}
            </Btn>
          </>
        )}
      </BottomSheet>

      <BottomSheet open={!!customerHistory} onClose={() => setCustomerHistory(null)} title={customerHistory?.name || "Customer History"}>
        {customerHistory && (
          customerHistoryLoading ? (
            <div style={{ textAlign:"center", padding:"30px 0" }}><Loader /></div>
          ) : customerHistory.error ? (
            <p style={{ fontSize:13, color:C.red, textAlign:"center", padding:"20px 0" }}>{customerHistory.error}</p>
          ) : customerHistory.bookings.length === 0 ? (
            <p style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"20px 0" }}>No booking history found for this customer.</p>
          ) : (
            <div>
              <p style={{ fontSize:12, color:C.muted, marginBottom:16 }}>{customerHistory.bookings.length} total booking{customerHistory.bookings.length!==1?"s":""} at your store</p>
              {customerHistory.bookings.map(b => (
                <div key={b._id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom:"1px solid #F0F2F8" }}>
                  <div>
                    <p style={{ fontSize:13, fontWeight:800, color:C.text }}>{b.service?.name}</p>
                    <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>{new Date(b.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})} · {b.timeSlot}</p>
                    {b.addedServices?.length > 0 && (
                      <p style={{ fontSize:10, color:"#B8860B", fontWeight:700, marginTop:2 }}>+ {b.addedServices.map(s=>s.name).join(", ")}</p>
                    )}
                    {b.status==="cancelled" && b.cancelReason && (
                      <p style={{ fontSize:10, color:C.red, fontStyle:"italic", marginTop:2 }}>Cancelled: "{b.cancelReason}"</p>
                    )}
                  </div>
                  <Badge color={b.status==="completed"?C.green:b.status==="in_progress"?C.pri:b.status==="confirmed"?C.blue:C.red} text={b.status.replace("_"," ")} />
                </div>
              ))}
            </div>
          )
        )}
      </BottomSheet>

      <BottomSheet open={showActivity} onClose={() => setShowActivity(false)} title="Recent Activity">
        {activityLoading ? (
          <div style={{ textAlign:"center", padding:"30px 0" }}><Loader /></div>
        ) : activity.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px 0" }}>
            <div style={{ width:44, height:44, borderRadius:14, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}><Bell size={20} color={C.pri} /></div>
            <p style={{ color:C.muted, fontSize:13, fontWeight:700 }}>No recent activity yet</p>
          </div>
        ) : (
          <div>
            {activity.map(a => (
              <div key={a._id} style={{ display:"flex", gap:10, padding:"11px 0", borderBottom:"1px solid #F0F2F8" }}>
                <div style={{ width:32, height:32, borderRadius:10, background:(a.type==="booking_cancelled"?C.red:C.green)+"15", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {a.type==="booking_cancelled" ? <XCircle size={15} color={C.red} /> : <CheckCircle size={15} color={C.green} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:800, color:C.text }}>{a.title}</p>
                  <p style={{ fontSize:12, color:C.muted, marginTop:2, lineHeight:1.4 }}>{a.message}</p>
                  <p style={{ fontSize:10, color:C.muted, marginTop:4 }}>{new Date(a.createdAt).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit",hour12:true})}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!slotBookings} onClose={() => setSlotBookings(null)} title={slotBookings ? (slotBookings.bookings.length ? `${slotBookings.time} — ${slotBookings.bookings.length} booked` : slotBookings.time) : "Slot"}>
        {slotBookings && slotBookings.bookings.length === 0 && (
          <p style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"20px 0" }}>This slot is marked booked, but the customer details couldn't be matched — check the Bookings tab for this date directly.</p>
        )}
        {slotBookings && slotBookings.bookings.map(b => (
          <div key={b._id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom:"1px solid #F0F2F8" }}>
            <div>
              <p onClick={() => { setSlotBookings(null); openCustomerHistory(b.customerName, b.customerPhone); }} style={{ fontSize:14, fontWeight:800, color:C.text, cursor:"pointer" }}>{b.customerName}</p>
              <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>{b.customerPhone} · {b.service?.name}{b.staffName?` · ${b.staffName}`:""}</p>
            </div>
            <Badge color={b.status==="completed"?C.green:b.status==="in_progress"?C.pri:C.blue} text={b.status.replace("_"," ")} />
          </div>
        ))}
      </BottomSheet>

      <BottomSheet open={showManageSlots} onClose={() => { setShowManageSlots(false); fetchGridSlots(gridDate); }} title="Manage Slots">
        <Suspense fallback={<Loader text="Loading..." />}>
          <OwnerBlockedDates />
          <OwnerBreakTimes />
        </Suspense>
      </BottomSheet>

      <BottomSheet open={!!addServiceBooking} onClose={() => setAddServiceBooking(null)} title={addServiceBooking ? `Add Service — ${addServiceBooking.customerName}` : "Add Service"}>
        {addServiceWarning && (
          <div style={{ background:C.acc+"18", border:`1.5px solid ${C.acc}`, borderRadius:12, padding:"12px 14px", marginBottom:14, display:"flex", gap:8, alignItems:"flex-start" }}>
            <AlertCircle size={15} color="#92610A" style={{ flexShrink:0, marginTop:1 }} />
            <div>
              <p style={{ fontSize:12, color:"#92610A", fontWeight:700, marginBottom:8 }}>{addServiceWarning}</p>
              <button onClick={()=>{setAddServiceBooking(null); setAddServiceWarning("");}} style={{ padding:"7px 16px", background:"#92610A", color:"#fff", border:"none", borderRadius:8, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                Got it, added anyway
              </button>
            </div>
          </div>
        )}
        {addServiceErr && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginBottom:10 }}>{addServiceErr}</p>}
        {!addServiceWarning && myStore?.services?.map(s => (
          <button
            key={s.name}
            disabled={addServiceLoading}
            onClick={() => addServiceToBooking(addServiceBooking._id, s.name)}
            style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 14px", background:"#fff", border:"1.5px solid #E8ECF5", borderRadius:12, marginBottom:8, cursor:addServiceLoading?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif", opacity:addServiceLoading?0.6:1 }}
          >
            <div style={{ textAlign:"left" }}>
              <p style={{ fontSize:13, fontWeight:800, color:C.text }}>{s.name}</p>
              <p style={{ fontSize:11, color:C.muted }}>{s.duration} min</p>
            </div>
            <span style={{ fontSize:14, fontWeight:900, color:C.pri }}>{s.isFree ? "FREE" : s.isPriceVariable ? "On Inspection" : `₹${s.price}`}</span>
          </button>
        ))}
      </BottomSheet>

      <BottomSheet open={showMoreMenu} onClose={() => setShowMoreMenu(false)} title="More">
        {MORE_TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setShowMoreMenu(false); }}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"13px 14px", background:tab===key?C.pri+"10":"#fff", border:`1.5px solid ${tab===key?C.pri+"33":"#E8ECF5"}`, borderRadius:12, marginBottom:8, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}
          >
            <Icon size={17} color={tab===key?C.pri:C.muted} strokeWidth={tab===key?2.5:1.8} />
            <span style={{ fontSize:14, fontWeight:800, color:tab===key?C.pri:C.text }}>{label}</span>
          </button>
        ))}
      </BottomSheet>

      <BottomNav tabs={OWNER_BOTTOM_TABS} active={isMoreTab ? "more" : tab} onChange={onOwnerNavChange} />
    </div>
  );
}