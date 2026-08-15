import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import { C, CATS, getCat, GROUPS, getGroupForCategory, DAY, MON } from "../../constants";
import { Badge, Card, Btn, Input, TopBar, BottomNav, Loader, Toast, MapPicker, LocationDetector, SlotPicker, BottomSheet, StarRating } from "../../components/UI";
import StoreCard from "../../components/StoreCard";
import BookingStepper from "../../components/BookingStepper";
import CategoryIllustration from "../../components/CategoryArt";
import BookingAssistant from "../../components/BookingAssistant";
import CustomerChatModal from "../../components/CustomerChatModal";
import ReferralScreen from "../../components/ReferralScreen";
import PrivacyPolicy from "../PrivacyPolicy";
import TermsOfService from "../TermsOfService";
import StoreMapView from "../../components/StoreMapView";
import { getNext7Days, getISTDateString, getISTDay, getISTDateNum, getISTMonthIdx } from "../../utils/date";
import { getStoreCover, getDirectionsUrl } from "../../utils/storeMedia";
import { haversineKm, formatDistance } from "../../utils/geo";
import { getSocket, joinRoom, leaveRoom } from "../../utils/socket";
import { playChime, playSoftPing } from "../../utils/sound";
import { enablePushNotifications } from "../../utils/push";
import {
  Search, X, MapPin, ChevronDown, ChevronRight,
  Clock, Phone, Home, Wrench, Calendar,
  Hash, Lock, CheckCircle, AlertCircle, MessageSquare,
  ClipboardList, Settings, HelpCircle, LogOut,
  IndianRupee, Circle, Shield, ArrowLeft, Ticket, Star,
  Users, Heart, RotateCcw, Bell, Wallet,
  ChevronUp, Mail, MessageCircle, FileText, Send, Navigation, Edit2, Trash2, Info, Link2, MapPinned,
  Map as MapIconLucide, List as ListIcon, ArrowUpDown, Share2, Sparkles, Image as ImageIcon, ChevronLeft, Tag, Percent, Gift
} from "lucide-react";

const InfoRow = ({ icon: Icon, text }) => text ? (
  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:5 }}>
    <Icon size={13} color={C.muted} />
    <span style={{ fontSize:12, color:C.muted }}>{text}</span>
  </div>
) : null;

const StepLabel = ({ n, label }) => (
  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
    <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${C.pri},#C0304A)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>{n}</span>
    </div>
    <h3 style={{ fontSize:14, fontWeight:900, color:C.text, margin:0 }}>{label}</h3>
  </div>
);

/* ── Tappable star rating row, used in the review bottom sheet ── */
const StarRow = ({ value, onChange, size = 38 }) => (
  <div style={{ display:"flex", justifyContent:"center", gap:8, margin:"6px 0 18px" }}>
    {[1,2,3,4,5].map(n => (
      <button
        key={n}
        onClick={() => onChange(n)}
        style={{ background:"none", border:"none", padding:4, cursor:"pointer", lineHeight:0 }}
        aria-label={`${n} star${n>1?"s":""}`}
      >
        <Star
          size={size}
          color={n<=value ? C.acc : "#E8ECF5"}
          fill={n<=value ? C.acc : "none"}
          strokeWidth={1.6}
        />
      </button>
    ))}
  </div>
);

function CustomerSettings({ user, onLogout, onOpenLegal }) {
  const [form,      setForm]      = useState({ name:user.name||"", phone:user.phone||"", email:user.email||"" });
  const [loading,   setLoading]   = useState(false);
  // Kept independent so future settings sections don't share ambiguous
  // success/error feedback with each other.
  const [profileMsg, setProfileMsg] = useState({ success:"", error:"" });
  // Starts locked — fields are visible but non-interactive until "Edit"
  // is tapped, preventing accidental changes. Locks back automatically
  // after a successful save.
  const [editingProfile,  setEditingProfile]  = useState(false);
  const set   = (k,v) => setForm(f=>({...f,[k]:v}));

  const saveProfile = async () => {
    setProfileMsg({ success:"", error:"" }); setLoading(true);
    try {
      await api("PUT", "/auth/update-profile", { name:form.name, phone:form.phone, email:form.email });
      setProfileMsg({ success:"Profile updated!", error:"" });
      setEditingProfile(false);
      setTimeout(() => setProfileMsg(m => ({ ...m, success:"" })), 2200);
    }
    catch(e) { setProfileMsg({ success:"", error:e.message }); }
    finally { setLoading(false); }
  };

  // ── Notification preferences ──────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    bookingReminders: user.notifPrefs?.bookingReminders ?? true,
    offers:            user.notifPrefs?.offers ?? true,
    chat:              user.notifPrefs?.chat ?? true,
  });
  const [notifStatus, setNotifStatus] = useState({ success:"", error:"" });
  const [notifSaving, setNotifSaving] = useState(false);

  const saveNotifPrefs = async (updated) => {
    setNotifPrefs(updated);
    setNotifSaving(true); setNotifStatus({ success:"", error:"" });
    try {
      await api("PUT", "/auth/update-profile", { notifPrefs: updated });
      setNotifStatus({ success:"Saved", error:"" });
      setTimeout(() => setNotifStatus(s => ({ ...s, success:"" })), 1800);
    } catch(e) { setNotifStatus({ success:"", error:e.message }); }
    finally { setNotifSaving(false); }
  };

  // ── Saved addresses (Home / Work / Other) ─────────────────────────
  const [addresses,    setAddresses]    = useState(user.savedAddresses || []);
  const [newAddrLabel, setNewAddrLabel] = useState("Home");
  const [newAddrText,  setNewAddrText]  = useState("");
  const [addrStatus,   setAddrStatus]   = useState({ success:"", error:"" });
  const [addrSaving,   setAddrSaving]   = useState(false);

  const saveAddresses = async (updated) => {
    setAddrSaving(true); setAddrStatus({ success:"", error:"" });
    try {
      await api("PUT", "/auth/update-profile", { savedAddresses: updated });
      setAddresses(updated);
      setAddrStatus({ success:"Saved", error:"" });
      setTimeout(() => setAddrStatus(s => ({ ...s, success:"" })), 1800);
    } catch(e) { setAddrStatus({ success:"", error:e.message }); }
    finally { setAddrSaving(false); }
  };

  const addAddress = () => {
    if (!newAddrText.trim()) return;
    const updated = [...addresses, { label: newAddrLabel, address: newAddrText.trim() }];
    setNewAddrText("");
    saveAddresses(updated);
  };

  const removeAddress = (idx) => {
    const updated = addresses.filter((_, i) => i !== idx);
    saveAddresses(updated);
  };

  // ── Delete account ─────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting,  setDeleting]  = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const deleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteErr('Please type "DELETE" to confirm');
      return;
    }
    setDeleting(true); setDeleteErr("");
    try {
      await api("DELETE", "/auth/delete-account", {});
      onLogout?.();
    } catch(e) {
      setDeleteErr(e.message);
      setDeleting(false);
    }
  };

  return (
    <div>
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ fontSize:15, fontWeight:900, color:C.text }}>Personal Info</h3>
          <button onClick={() => setEditingProfile(v=>!v)} style={{ background:editingProfile?C.green+"15":C.pri+"15", color:editingProfile?C.green:C.pri, border:"none", borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
            <Edit2 size={12} /> {editingProfile ? "Editing" : "Edit"}
          </button>
        </div>
        <div style={{ opacity: editingProfile ? 1 : 0.6, transition:"opacity 0.15s" }}>
          <Input label="Full Name" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Your full name" disabled={!editingProfile} />
          <Input label="Email" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="your.email@example.com" disabled={!editingProfile} />
          {/^\d{10}@sloty\.com$/.test(user.email||"") && (
            <p style={{ fontSize:11, color:C.acc, fontWeight:700, marginTop:-8, marginBottom:12, display:"flex", alignItems:"center", gap:5 }}>
              <AlertCircle size={12} /> This is a placeholder email from phone sign-up — add your real email so you don't miss booking confirmations.
            </p>
          )}
          <Input label="Phone" value={form.phone} onChange={e=>set("phone",e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10-digit mobile number" disabled={!editingProfile} />
        </div>
        {profileMsg.success && <p style={{ color:C.green, fontSize:12, fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><CheckCircle size={13} /> {profileMsg.success}</p>}
        {profileMsg.error   && <p style={{ color:C.red,   fontSize:12, fontWeight:700, marginBottom:10 }}>{profileMsg.error}</p>}
        <Btn onClick={saveProfile} disabled={loading || !editingProfile}>{loading?"Saving...":"Save Changes"}</Btn>
      </Card>

      {/* ── Notification Preferences ── */}
      <Card>
        <h3 style={{ fontSize:15, fontWeight:900, color:C.text, marginBottom:14 }}>Notification Preferences</h3>
        {[
          { key:"bookingReminders", label:"Booking Reminders", sub:"Time-to-leave alerts before your slot" },
          { key:"offers",           label:"Offers & Promotions", sub:"New deals from stores you follow" },
          { key:"chat",             label:"Chat Messages",       sub:"Replies from store owners" },
        ].map(({ key, label, sub }) => (
          <div key={key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #F0F2F8" }}>
            <div>
              <p style={{ fontSize:13, fontWeight:800, color:C.text }}>{label}</p>
              <p style={{ fontSize:11, color:C.muted }}>{sub}</p>
            </div>
            <button
              onClick={() => saveNotifPrefs({ ...notifPrefs, [key]: !notifPrefs[key] })}
              disabled={notifSaving}
              style={{ width:44, height:26, borderRadius:14, background:notifPrefs[key]?C.green:"#E0E4EF", border:"none", cursor:notifSaving?"not-allowed":"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}
            >
              <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:notifPrefs[key]?21:3, transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
        ))}
        {notifStatus.error && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginTop:10 }}>{notifStatus.error}</p>}
      </Card>

      {/* ── Saved Addresses ── */}
      <Card>
        <h3 style={{ fontSize:15, fontWeight:900, color:C.text, marginBottom:14 }}>Saved Addresses</h3>
        {addresses.length === 0 && (
          <p style={{ fontSize:12, color:C.muted, marginBottom:14 }}>No saved addresses yet — add Home or Work for faster booking.</p>
        )}
        {addresses.map((a, i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.inputBg, borderRadius:12, padding:"10px 14px", marginBottom:8, border:"1.5px solid #E8ECF5" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
              <MapPinned size={15} color={C.pri} style={{ flexShrink:0 }} />
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:12, fontWeight:800, color:C.text }}>{a.label}</p>
                <p style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.address}</p>
              </div>
            </div>
            <button onClick={() => removeAddress(i)} disabled={addrSaving} style={{ background:"none", border:"none", cursor:"pointer", flexShrink:0, padding:6 }}>
              <Trash2 size={14} color={C.red} />
            </button>
          </div>
        ))}
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          {["Home","Work","Other"].map(l => (
            <button key={l} onClick={() => setNewAddrLabel(l)} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${newAddrLabel===l?C.pri:"#E8ECF5"}`, background:newAddrLabel===l?C.pri+"12":"#fff", color:newAddrLabel===l?C.pri:C.muted, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input value={newAddrText} onChange={e=>setNewAddrText(e.target.value)} placeholder="Enter address" style={{ flex:1, padding:"11px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:13, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box" }} />
          <button onClick={addAddress} disabled={addrSaving || !newAddrText.trim()} style={{ padding:"0 18px", background:C.pri, color:"#fff", border:"none", borderRadius:12, fontWeight:800, cursor:addrSaving?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif" }}>
            Add
          </button>
        </div>
        {addrStatus.error && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginTop:10 }}>{addrStatus.error}</p>}
      </Card>

      {/* ── Linked Accounts ── */}
      <Card>
        <h3 style={{ fontSize:15, fontWeight:900, color:C.text, marginBottom:14 }}>Linked Accounts</h3>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0" }}>
          <div style={{ width:36, height:36, borderRadius:10, background:C.inputBg, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Link2 size={16} color={C.muted} />
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:800, color:C.text }}>Google</p>
            <p style={{ fontSize:11, color:C.muted }}>{user.googleId ? "Connected" : "Not connected"}</p>
          </div>
          {user.googleId && (
            <div style={{ background:C.green+"15", color:C.green, fontSize:10, fontWeight:800, padding:"4px 10px", borderRadius:20 }}>Linked</div>
          )}
        </div>
      </Card>

      {/* ── About & Legal ── */}
      <Card>
        <h3 style={{ fontSize:15, fontWeight:900, color:C.text, marginBottom:14 }}>About</h3>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0" }}>
          <Info size={15} color={C.muted} />
          <p style={{ fontSize:12, color:C.muted }}>Sloty v1.0.0</p>
        </div>
        <div onClick={() => onOpenLegal("terms")} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderTop:"1px solid #F0F2F8", cursor:"pointer" }}>
          <p style={{ fontSize:13, fontWeight:700, color:C.text }}>Terms of Service</p>
          <ChevronRight size={16} color={C.muted} />
        </div>
        <div onClick={() => onOpenLegal("privacy")} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderTop:"1px solid #F0F2F8", cursor:"pointer" }}>
          <p style={{ fontSize:13, fontWeight:700, color:C.text }}>Privacy Policy</p>
          <ChevronRight size={16} color={C.muted} />
        </div>
      </Card>

      {/* ── Delete Account ── */}
      <Card>
        <h3 style={{ fontSize:15, fontWeight:900, color:C.red, marginBottom:6 }}>Delete Account</h3>
        <p style={{ fontSize:12, color:C.muted, marginBottom:14 }}>This permanently deletes your account, bookings, and wallet balance. This can't be undone.</p>
        <button onClick={() => setShowDeleteConfirm(true)} style={{ width:"100%", padding:"12px", background:C.red+"12", color:C.red, border:`1.5px solid ${C.red}33`, borderRadius:12, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Trash2 size={14} /> Delete My Account
        </button>
      </Card>

      {showDeleteConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.card, borderRadius:20, padding:22, width:"100%", maxWidth:340 }}>
            <h3 style={{ fontSize:16, fontWeight:900, color:C.red, marginBottom:8 }}>Delete your account?</h3>
            <p style={{ fontSize:12, color:C.muted, marginBottom:16, lineHeight:1.5 }}>
              This is permanent. Your bookings, wallet balance, referral history, and profile will all be erased. Type <strong>DELETE</strong> below to confirm.
            </p>
            <input value={deleteConfirmText} onChange={e=>setDeleteConfirmText(e.target.value)} placeholder="Type DELETE" style={{ width:"100%", padding:"12px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, fontFamily:"'Nunito',sans-serif", marginBottom:12, boxSizing:"border-box" }} />
            {deleteErr && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginBottom:12 }}>{deleteErr}</p>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleteErr(""); }} disabled={deleting} style={{ flex:1, padding:"12px", background:C.inputBg, border:"none", borderRadius:12, color:C.text, fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                Cancel
              </button>
              <button onClick={deleteAccount} disabled={deleting} style={{ flex:1, padding:"12px", background:C.red, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:13, cursor:deleting?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif" }}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Search term → { categories, keywords } mapping. Plain substring
// matching alone misses obvious cases — "dental" never literally
// appears inside "Dentist", and a single service like "Oil Change"
// realistically applies to BOTH bike and car mechanics, not just
// whichever store happens to name a service that exact way. When the
// user's search matches (or is matched by) a key here, we broaden the
// search to also accept stores in the listed categories, and match
// against the wider set of related keywords — not just the literal
// typed string. Falls back to plain substring matching for anything
// not covered here (e.g. searching an actual store name directly).
const SEARCH_SYNONYMS = {
  dental:      { categories:["dentist"],                          keywords:["dentist","dental","teeth","tooth","braces","root canal"] },
  dentist:     { categories:["dentist"],                          keywords:["dentist","dental","teeth","tooth"] },
  teeth:       { categories:["dentist"],                          keywords:["dentist","dental","teeth","tooth"] },
  tooth:       { categories:["dentist"],                          keywords:["dentist","dental","teeth","tooth"] },
  "oil change":{ categories:["mechanic_bike","mechanic_car"],     keywords:["oil","service","engine","mechanic"] },
  oil:         { categories:["mechanic_bike","mechanic_car"],     keywords:["oil","service","engine"] },
  mechanic:    { categories:["mechanic_bike","mechanic_car"],     keywords:["mechanic","service","repair"] },
  service:     { categories:["mechanic_bike","mechanic_car"],     keywords:["service","oil","repair","mechanic"] },
  bike:        { categories:["mechanic_bike"],                    keywords:["bike","motorcycle","scooter","two wheeler"] },
  motorcycle:  { categories:["mechanic_bike"],                    keywords:["bike","motorcycle","scooter"] },
  car:         { categories:["mechanic_car"],                     keywords:["car","vehicle","auto","four wheeler"] },
  vehicle:     { categories:["mechanic_car"],                     keywords:["car","vehicle","auto"] },
  haircut:     { categories:["salon","unisex_salon"],              keywords:["haircut","hair","salon","barber","trim"] },
  hair:        { categories:["salon","beauty_parlour","unisex_salon"], keywords:["hair","haircut","salon","styling"] },
  barber:      { categories:["salon"],                            keywords:["barber","haircut","salon","shave"] },
  shave:       { categories:["salon"],                            keywords:["shave","barber","salon"] },
  unisex:      { categories:["unisex_salon"],                      keywords:["unisex","salon","hair","styling"] },
  facial:      { categories:["beauty_parlour","salon"],           keywords:["facial","beauty","skin","parlour"] },
  beauty:      { categories:["beauty_parlour"],                   keywords:["beauty","parlour","facial","makeup"] },
  makeup:      { categories:["beauty_parlour"],                   keywords:["makeup","beauty","parlour"] },
  eye:         { categories:["optician"],                         keywords:["eye","optician","vision","glasses","spectacles"] },
  vision:      { categories:["optician"],                         keywords:["eye","optician","vision","glasses"] },
  glasses:     { categories:["optician"],                         keywords:["glasses","optician","eye","spectacles"] },
  doctor:      { categories:["doctor"],                           keywords:["doctor","clinic","physician","consultation"] },
  clinic:      { categories:["doctor"],                           keywords:["doctor","clinic","consultation"] },
  physician:   { categories:["doctor"],                           keywords:["doctor","physician","clinic"] },
  mobile:      { categories:["mobile_repair"],                    keywords:["mobile","phone","repair","screen"] },
  phone:       { categories:["mobile_repair"],                    keywords:["mobile","phone","repair","screen"] },
  screen:      { categories:["mobile_repair"],                    keywords:["screen","mobile","phone","repair"] },
  lab:         { categories:["medical_lab"],                      keywords:["lab","test","blood","medical","pathology"] },
  test:        { categories:["medical_lab"],                      keywords:["lab","test","blood","medical"] },
  blood:       { categories:["medical_lab"],                      keywords:["blood","lab","test"] },
};

/** Expands a raw search query into a broader set of category ids and
 *  keywords to match against, using SEARCH_SYNONYMS. Checks both
 *  directions — the query containing a known key, or a known key
 *  containing the query (so partial typing like "dent" while typing
 *  toward "dental" still finds the right expansion as the user types). */
function expandSearchQuery(query) {
  const q = query.toLowerCase().trim();
  if (!q) return { categories:[], keywords:[] };
  const categories = new Set();
  const keywords = new Set([q]);
  for (const [key, expansion] of Object.entries(SEARCH_SYNONYMS)) {
    if (key.includes(q) || q.includes(key)) {
      expansion.categories.forEach(c => categories.add(c));
      expansion.keywords.forEach(k => keywords.add(k));
    }
  }
  return { categories: [...categories], keywords: [...keywords] };
}

/** Builds a short list of "did you mean" style suggestions as the
 *  customer types — drawing from known search terms (SEARCH_SYNONYMS
 *  keys, so typing "dent" surfaces "dental" before they finish typing
 *  it), plus real store names and real service names from whatever's
 *  currently loaded. Capped at 6 so the dropdown never overwhelms the
 *  small mobile screen. Requires at least 2 characters, so it doesn't
 *  fire on every single keystroke starting from nothing. */
function getSearchSuggestions(query, stores) {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const suggestions = [];
  const seen = new Set();
  const add = (label, type) => {
    const key = label.toLowerCase();
    if (seen.has(key) || key === q) return; // skip exact match of what's already typed
    seen.add(key);
    suggestions.push({ label, type });
  };

  // Known search terms — prioritized first, since these are curated
  // and most likely to lead to a genuinely useful result.
  Object.keys(SEARCH_SYNONYMS).forEach(term => {
    if (term.startsWith(q)) add(term, "term");
  });

  // Real store names currently loaded
  stores.forEach(s => {
    if (s.name?.toLowerCase().includes(q)) add(s.name, "store");
  });

  // Real service names currently loaded
  stores.forEach(s => {
    (s.services || []).forEach(svc => {
      if (svc.name?.toLowerCase().includes(q)) add(svc.name, "service");
    });
  });

  return suggestions.slice(0, 6);
}

export default function CustomerApp() {
  const { user, logout, refreshUser } = useAuth();

  // Restores the tab you were on if the browser reloaded this page in
  // the background (very common on Android — the OS kills backgrounded
  // tabs under memory pressure, and returning to it triggers a full
  // reload that would otherwise always land back on Home). Only the
  // top-level tab is restored, not the deeper `screen` — a specific
  // sub-screen like a store's detail page depends on other state (which
  // store, which booking) that genuinely can't survive a reload, so
  // restoring it directly risks landing on a broken/empty screen. The
  // tab itself is always safe, since each tab's main view is
  // self-contained.
  const [tab,           setTab]          = useState(() => sessionStorage.getItem("sloty-customer-tab") || "home");
  const [screen,        setScreen]       = useState("home");
  const [stores,        setStores]       = useState([]);
  const [myBookings,    setMyBookings]   = useState([]);
  const [selCat,        setSelCat]       = useState(null);
  const [selGroup,      setSelGroup]     = useState(null); // active home-screen group ("health"/"mechanic"/"beauty"), or null
  const [selStore,      setSelStore]     = useState(null);
  const [selServices,   setSelServices]  = useState([]); // multi-select — array of {name,price,duration}
  const [selStaff,      setSelStaff]     = useState(null);
  const [staffSpecFilter, setStaffSpecFilter] = useState("All");
  const [selSlot,       setSelSlot]      = useState(null);
  const [selDateIdx,    setSelDateIdx]   = useState(0);
  const [slots,         setSlots]        = useState([]);
  const [dayClosure,    setDayClosure]   = useState({ isWholeDayClosed:false, closureReason:null });
  const [rescheduleModal,       setRescheduleModal]       = useState(null); // booking being rescheduled
  const [rescheduleDateIdx,     setRescheduleDateIdx]     = useState(0);
  const [rescheduleSlot,        setRescheduleSlot]        = useState(null);
  const [rescheduleSlots,       setRescheduleSlots]       = useState([]);
  const [rescheduleSlotsLoading,setRescheduleSlotsLoading]= useState(false);
  const [rescheduleDayClosure,  setRescheduleDayClosure]  = useState({ isWholeDayClosed:false, closureReason:null });
  const [rescheduling,          setRescheduling]          = useState(false);
  const [slotsLoading,  setSlotsLoading] = useState(false);
  const [confirmed,     setConfirmed]    = useState(null);
  const [loading,       setLoading]      = useState(false);
  const [search,        setSearch]       = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [filter,        setFilter]       = useState("All");
  const [viewMode,      setViewMode]     = useState("list"); // "list" | "map"
  const [sortNearest,   setSortNearest]  = useState(false);
  const [myLocation,    setMyLocation]   = useState(null); // { lat, lng } — captured lazily, best-effort
  const [err,           setErr]          = useState("");
  const [userCity,      setUserCity]     = useState(user.city||"");
  const [userArea,      setUserArea]     = useState(user.area||"");
  // Blocks every screen until a new customer completes their profile —
  // Google Sign-In in particular skips phone entirely, and any new
  // signup could be missing city, which store search/distance depend
  // on. Recomputed fresh from `user` each render rather than frozen at
  // mount, so it correctly clears the moment the profile is completed.
  const hasPlaceholderEmail = /^\d{10}@sloty\.com$/i.test(user.email||"");
  const needsProfileCompletion = !user.city?.trim() || !user.phone?.trim() || hasPlaceholderEmail;
  const [profileForm,   setProfileForm]   = useState({ phone: user.phone||"", city: user.city||"", area: user.area||"", email: hasPlaceholderEmail?"":(user.email||"") });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErr,    setProfileErr]    = useState("");
  const [showLocPicker, setShowLocPicker]= useState(false);
  const [showSettings,  setShowSettings] = useState(false);
  const [showChat,      setShowChat]     = useState(false);
  const [showReferral,  setShowReferral] = useState(false);
  const [photoViewerIdx, setPhotoViewerIdx] = useState(null); // index of photo shown full-screen, or null
  const swipeStartXRef = useRef(null); // tracks touch start position for swipe-to-navigate in the photo viewer
  const [storeOffersMap, setStoreOffersMap] = useState({}); // { storeId: { discountType, discountValue, title } } for badges on store cards
  const [storeOffers,    setStoreOffers]    = useState([]);   // active offers for the currently viewed store
  const [selectedOffer,  setSelectedOffer]  = useState(null); // offer chosen at checkout, or null
  const [showAssistant, setShowAssistant] = useState(false);
  const [useWallet,     setUseWallet]    = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [upiEnabled, setUpiEnabled] = useState(false);
  // "cash" (pay the store directly) or "upi" (pay online now via
  // Razorpay). pendingPayment holds the booking+order details between
  // the booking being reserved and payment actually completing —
  // while it's set, the checkout screen shows a "complete payment"
  // step instead of jumping straight to the confirmation screen.
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [pendingPayment, setPendingPayment] = useState(null);
  const [payingNow, setPayingNow] = useState(false);
  const [switchingToCash, setSwitchingToCash] = useState(false);
  const [toast,         setToast]        = useState(null);

  // ── Review modal state ──────────────────────────────────────────────────
  const [reviewModal,      setReviewModal]      = useState(null); // booking being reviewed
  const [cancelModal,      setCancelModal]      = useState(null); // booking currently being cancelled
  const [cancelReason,     setCancelReason]     = useState("");
  const [cancelReasonOther, setCancelReasonOther] = useState("");
  const [cancelling,       setCancelling]       = useState(false);
  const [reviewRating,     setReviewRating]     = useState(0);
  const [reviewComment,    setReviewComment]    = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewedStores,   setReviewedStores]   = useState(new Set());

  // ── Favorites state ──────────────────────────────────────────────────────
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favStores,   setFavStores]   = useState([]);
  const [favLoading,  setFavLoading]  = useState(false);

  // ── Live queue position state ────────────────────────────────────────────
  const [queueAhead, setQueueAhead] = useState({}); // { [bookingId]: numberAhead }

  // ── Book Again state ─────────────────────────────────────────────────────
  const [bookAgainId, setBookAgainId] = useState(null);

  // ── Help & Support state ─────────────────────────────────────────────────
  const [openFaq,        setOpenFaq]        = useState(null);
  const [myTickets,      setMyTickets]      = useState([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [legalOverlay, setLegalOverlay] = useState(null); // null | "terms" | "privacy" — shown in-app from Settings, wired into the same back-gesture system as every other overlay below

  // Syncs internal navigation (screen/tab, plus every overlay: Settings,
  // Chat, Referral, AI Assistant, Location Picker, Report a Problem,
  // and the in-Settings Terms/Privacy pages) with real browser history,
  // so Android's native back gesture and the on-screen/hardware back
  // button both correctly step backward.
  //
  // Each history entry stores a FULL snapshot of every overlay flag —
  // not just a single "is something open" boolean — specifically so
  // NESTED overlays restore correctly. Opening Terms from within
  // Settings, then going back, needs to land on "Settings open, Terms
  // closed," not just "some overlay was open" (a boolean couldn't
  // distinguish those two states, which was a real bug in an earlier
  // version of this).
  const isPoppingRef = useRef(false);
  useEffect(() => {
    if (isPoppingRef.current) { isPoppingRef.current = false; return; }
    window.history.pushState({
      screen, tab, showLocPicker, showSettings, showChat,
      showReferral, showAssistant, showReportForm, legalOverlay,
    }, "");
  }, [screen, tab, showLocPicker, showSettings, showChat, showReferral, showAssistant, showReportForm, legalOverlay]);
  useEffect(() => {
    const onPopState = (e) => {
      isPoppingRef.current = true;
      if (!e.state) return;
      setShowLocPicker(!!e.state.showLocPicker);
      setShowSettings(!!e.state.showSettings);
      setShowChat(!!e.state.showChat);
      setShowReferral(!!e.state.showReferral);
      setShowAssistant(!!e.state.showAssistant);
      setShowReportForm(!!e.state.showReportForm);
      setLegalOverlay(e.state.legalOverlay || null);
      if (e.state.screen) setScreen(e.state.screen);
      if (e.state.tab)    setTab(e.state.tab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [reportCategory, setReportCategory] = useState("booking_issue");
  const [reportSubject,  setReportSubject]  = useState("");
  const [reportMessage,  setReportMessage]  = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const showToast = (msg, type="success") => setToast({ msg, type });
  const dates = getNext7Days();
  const activeStaff = selStore?.staff?.filter(s => s.isActive) || [];
  const needsStaff = !!(selStore?.hasStaff && activeStaff.length > 0);
  const staffSpecs = ["All", ...new Set(activeStaff.map(s => s.specialization).filter(Boolean))];
  const visibleStaff = staffSpecFilter === "All" ? activeStaff : activeStaff.filter(s => s.specialization === staffSpecFilter);

  const openBooking = (store) => {
    setSelStore(store);
    setSelServices([]);
    setSelStaff(null);
    setStaffSpecFilter("All");
    setSelSlot(null);
    setSelDateIdx(0);
    setUseWallet(false);
    setScreen("booking");
    // Fetch fresh wallet balance each time booking screen opens
    api("GET", "/referral/my").then(res => { setWalletBalance(res.walletBalance || 0); setReferralEnabled(!!res.programEnabled); }).catch(()=>{});
  };

  // Toggles a service in/out of the multi-select. Matched by name since
  // that's the stable identifier shared with the backend's service list.
  const toggleService = (svc) => {
    setSelServices(prev =>
      prev.some(s => s.name === svc.name)
        ? prev.filter(s => s.name !== svc.name)
        : [...prev, svc]
    );
    setSelSlot(null); // total duration changed — old slot may no longer be valid
  };

  const totalServicePrice    = selServices.reduce((sum, s) => sum + s.price, 0);
  const totalServiceDuration = selServices.reduce((sum, s) => sum + s.duration, 0);
  // If any selected service has no fixed price (PPF, repairs needing
  // unknown parts), online prepayment/wallet/offers don't make sense —
  // none of them can be calculated against an unknown amount. Also
  // enforced server-side in bookingController.js — this is just the
  // matching UI-level restriction, not the actual security boundary.
  const hasVariablePriceSelected = selServices.some(s => s.isPriceVariable);

  const CANCEL_REASONS = [
    "Change of plans",
    "Found another option",
    "Booked by mistake",
    "Price too high",
    "Other",
  ];

  const openCancelModal = (booking) => {
    setCancelModal(booking);
    setCancelReason("");
    setCancelReasonOther("");
  };

  const confirmCancelBooking = async () => {
    if (!cancelModal) return;
    const reason = cancelReason === "Other" ? (cancelReasonOther.trim() || "Other") : cancelReason;
    if (!reason) { showToast("Please select a reason", "error"); return; }
    setCancelling(true);
    try {
      const res = await api("PUT", `/bookings/${cancelModal._id}/cancel`, { reason });
      if (res.refund?.refunded) {
        showToast(`Booking cancelled — ₹${res.refund.amount} credited to your wallet`);
        api("GET", "/referral/my").then(r => { setWalletBalance(r.walletBalance || 0); setReferralEnabled(!!r.programEnabled); }).catch(()=>{});
      } else if (res.refund && !res.refund.refunded) {
        showToast(`Booking cancelled — no refund (${res.refund.reason})`, "error");
      } else {
        showToast("Booking cancelled");
      }
      setCancelModal(null);
      fetchMyBookings();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setCancelling(false);
    }
  };

  const rescheduleDates = getNext7Days();

  const openRescheduleModal = (booking) => {
    setRescheduleModal(booking);
    setRescheduleDateIdx(0);
    setRescheduleSlot(null);
    setRescheduleSlots([]);
  };

  // Fetches available slots for the store/date currently selected
  // inside the reschedule modal — separate from the main booking
  // flow's fetchSlots call so opening this modal never disturbs
  // whatever the customer might already have set up in a fresh booking
  // elsewhere in the app.
  useEffect(() => {
    if (!rescheduleModal) return;
    const dateStr = getISTDateString(rescheduleDates[rescheduleDateIdx]);
    setRescheduleSlotsLoading(true);
    const staffParam = rescheduleModal.staffId ? `&staffId=${rescheduleModal.staffId}` : "";
    api("GET", `/bookings/slots/${rescheduleModal.store._id}?date=${dateStr}&duration=${rescheduleModal.service?.duration||30}${staffParam}`)
      .then(res => {
        setRescheduleSlots(res.slots || []);
        setRescheduleDayClosure({ isWholeDayClosed: !!res.isWholeDayClosed, closureReason: res.closureReason||null });
      })
      .catch(() => {})
      .finally(() => setRescheduleSlotsLoading(false));
  }, [rescheduleModal, rescheduleDateIdx]);

  const confirmReschedule = async () => {
    if (!rescheduleModal || !rescheduleSlot) return;
    setRescheduling(true);
    try {
      await api("PUT", `/bookings/${rescheduleModal._id}/reschedule`, {
        date: getISTDateString(rescheduleDates[rescheduleDateIdx]),
        timeSlot: rescheduleSlot,
      });
      showToast("Booking rescheduled!");
      setRescheduleModal(null);
      fetchMyBookings();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setRescheduling(false);
    }
  };

  const openReview = (booking) => {
    setReviewModal(booking);
    setReviewRating(0);
    setReviewComment("");
  };

  const submitReview = async () => {
    if (!reviewModal || reviewRating === 0) return;
    setReviewSubmitting(true);
    try {
      await api("POST", `/stores/${reviewModal.store._id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      showToast("Thanks for your review! ⭐");
      setReviewedStores(s => new Set(s).add(reviewModal.store._id));
      setReviewModal(null);
    } catch (e) {
      if (e.message.toLowerCase().includes("already reviewed")) {
        setReviewedStores(s => new Set(s).add(reviewModal.store._id));
        showToast("You've already reviewed this store", "error");
        setReviewModal(null);
      } else {
        showToast(e.message, "error");
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ── Favorites ─────────────────────────────────────────────────────────────
  const fetchFavorites = async () => {
    setFavLoading(true);
    try {
      const res = await api("GET", "/auth/favorites");
      const storesList = res.stores || [];
      setFavStores(storesList);
      setFavoriteIds(new Set(storesList.map(s => s._id)));
      // Same batch offer fetch as fetchStores — favorites is a
      // separate data source, so it needs its own call to make sure
      // offer badges show correctly here too.
      const ids = storesList.map(s => s._id).filter(Boolean);
      if (ids.length > 0) {
        api("GET", `/offers/batch?storeIds=${ids.join(",")}`)
          .then(r => setStoreOffersMap(prev => ({ ...prev, ...(r.offers || {}) })))
          .catch(() => {});
      }
    } catch (e) { console.error("fetchFavorites failed:", e.message); }
    finally { setFavLoading(false); }
  };

  // Captures the customer's location only when actually needed (tapping
  // "Nearest First" or "Map" view) rather than asking on every app load.
  const ensureMyLocation = () => new Promise((resolve) => {
    if (myLocation) return resolve(myLocation);
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setMyLocation(loc); resolve(loc); },
      () => resolve(null),
      { timeout: 6000 }
    );
  });

  // Native share sheet on mobile (WhatsApp, SMS, etc. all show up
  // automatically); falls back to copying a link on desktop browsers
  // that don't support the Web Share API.
  // Falls back to an older, more broadly-supported copy method when the
  // modern Clipboard API isn't available — which is exactly the case
  // when testing over a plain-HTTP LAN IP (e.g. http://192.168.x.x),
  // since navigator.clipboard is restricted to secure contexts
  // (HTTPS or localhost) and simply doesn't exist otherwise.
  const copyTextFallback = async (text) => {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch (e) { /* fall through to the manual method below */ }
    }
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

  const shareStore = async (store) => {
    const shareUrl = `${window.location.origin}/store/${store._id}`;
    const shareText = `Check out ${store.name} on Sloty — skip the queue, book your slot instantly!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: store.name, text: shareText, url: shareUrl });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // user cancelled the share sheet — not an error
        // Any other failure falls through to the copy fallback below,
        // instead of leaving the user with nothing.
      }
    }
    const ok = await copyTextFallback(`${shareText} ${shareUrl}`);
    showToast(ok ? "Link copied to clipboard!" : "Couldn't copy link — please try again", ok ? "success" : "error");
  };

  const toggleFavorite = async (store) => {
    const id = store._id;
    const wasFav = favoriteIds.has(id);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      wasFav ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      await api("PUT", `/auth/favorites/${id}`);
      if (!wasFav) showToast("Added to favorites ❤️");
    } catch (e) {
      setFavoriteIds(prev => {
        const next = new Set(prev);
        wasFav ? next.add(id) : next.delete(id);
        return next;
      });
      showToast(e.message, "error");
    }
  };

  // ── Live queue position ──────────────────────────────────────────────────
  const refreshQueuePositions = async (bookingsList) => {
    const today = getISTDateString();
    const relevant = bookingsList.filter(b => b.status === "confirmed" && b.date === today && b.store?._id);
    if (relevant.length === 0) { setQueueAhead({}); return; }
    // Group by store+staff pair — a staff-specific booking must check
    // that staff member's own queue, not the whole store's.
    const pairs = [...new Set(relevant.map(b => `${b.store._id}|${b.staffId||""}`))];
    const results = {};
    await Promise.all(pairs.map(async (pairKey) => {
      const [storeId, staffId] = pairKey.split("|");
      try {
        const staffParam = staffId ? `?staffId=${staffId}` : "";
        const res = await api("GET", `/bookings/queue/${storeId}${staffParam}`);
        const queue = res.queue || [];
        relevant.filter(b => b.store._id === storeId && (b.staffId||"") === staffId).forEach(b => {
          const idx = queue.findIndex(q => q._id === b._id);
          if (idx > -1) results[b._id] = idx;
        });
      } catch (e) { /* non-critical, skip */ }
    }));
    setQueueAhead(results);
  };

  // ── Book Again ────────────────────────────────────────────────────────────
  const bookAgain = async (booking) => {
    if (!booking.store?._id) return;
    setBookAgainId(booking._id);
    try {
      const res = await api("GET", `/stores/${booking.store._id}`);
      const store = res.store;
      // Older bookings (made before multi-service support) only have a
      // single combined `service` field — fall back to matching just that
      // one if there's no itemized breakdown to work from.
      const namesToMatch = booking.serviceBreakdown?.length
        ? booking.serviceBreakdown.map(s => s.name)
        : [booking.service?.name].filter(Boolean);
      const matchedServices = namesToMatch
        .map(name => store.services?.find(s => s.name === name))
        .filter(Boolean);
      const matchedStaff = (store.hasStaff && booking.staffName)
        ? store.staff?.find(s => s.name === booking.staffName && s.isActive) || null
        : null;
      setSelStore(store);
      setSelServices(matchedServices.length ? matchedServices : (store.services?.[0] ? [store.services[0]] : []));
      setSelStaff(matchedStaff);
      setStaffSpecFilter("All");
      setSelSlot(null);
      setSelDateIdx(0);
      setScreen("booking");
    } catch (e) {
      showToast("This store is currently unavailable", "error");
    } finally {
      setBookAgainId(null);
    }
  };

  // ── Help & Support ───────────────────────────────────────────────────────
  const fetchMyTickets = async () => {
    try { const res = await api("GET", "/support/my"); setMyTickets(res.tickets || []); }
    catch (e) { console.error("fetchMyTickets failed:", e.message); }
  };

  const submitTicket = async () => {
    if (!reportSubject.trim() || !reportMessage.trim()) {
      showToast("Please fill in both the subject and details", "error");
      return;
    }
    setReportSubmitting(true);
    try {
      await api("POST", "/support", { category: reportCategory, subject: reportSubject, message: reportMessage });
      showToast("Report submitted — we'll look into it soon");
      setShowReportForm(false);
      setReportSubject(""); setReportMessage(""); setReportCategory("booking_issue");
      fetchMyTickets();
    } catch (e) { showToast(e.message, "error"); }
    finally { setReportSubmitting(false); }
  };

  const bookingStep = selServices.length===0 ? 0
    : (needsStaff && !selStaff) ? 1
    : selSlot ? (needsStaff ? 3 : 2)
    : (needsStaff ? 2 : 1);
  const bookingSteps = needsStaff ? ["Service","Staff","Date","Time"] : ["Service","Date","Time"];

  const fetchStores = useCallback(async (params="") => {
    setLoading(true);
    try {
      const cityParam = userCity ? `&city=${encodeURIComponent(userCity)}` : "";
      const res = await api("GET", `/stores?${params}${cityParam}`);
      setStores(res.stores||[]);
      // Batch-fetch active offers for every store just loaded, in one
      // request — shows a discount badge on each card without needing
      // a separate API call per card.
      const ids = (res.stores||[]).map(s => s._id).filter(Boolean);
      if (ids.length > 0) {
        api("GET", `/offers/batch?storeIds=${ids.join(",")}`)
          .then(r => setStoreOffersMap(r.offers || {}))
          .catch(() => {});
      } else {
        setStoreOffersMap({});
      }
    } catch(e) { setErr(e.message); } finally { setLoading(false); }
  }, [userCity]);

  const fetchMyBookings = async () => {
    try { const res = await api("GET", "/bookings/my"); setMyBookings(res.bookings||[]); }
    catch(e) { console.error("fetchMyBookings failed:", e.message); }
  };

  const fetchSlots = async (storeId, date, duration=30, staffId=null) => {
    setSlotsLoading(true);
    try {
      const staffParam = staffId ? `&staffId=${staffId}` : "";
      const res = await api("GET", `/bookings/slots/${storeId}?date=${date}&duration=${duration}${staffParam}`);
      setSlots(res.slots||[]);
      setDayClosure({ isWholeDayClosed: !!res.isWholeDayClosed, closureReason: res.closureReason||null });
    } catch(e) { console.error(e); } finally { setSlotsLoading(false); }
  };

  const saveProfileCompletion = async () => {
    if (!profileForm.city.trim()) { setProfileErr("Please enter your city"); return; }
    if (!profileForm.phone.trim()) { setProfileErr("Please enter your phone number"); return; }
    if (!/^[6-9]\d{9}$/.test(profileForm.phone.trim())) { setProfileErr("Enter a valid 10-digit Indian mobile number"); return; }
    // Email is only required here if the account currently has a
    // placeholder (auto-generated) one — if a real email was already
    // set some other way (e.g. Google Sign-In), don't force re-entry.
    if (hasPlaceholderEmail) {
      if (!profileForm.email.trim()) { setProfileErr("Please enter your email address"); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())) { setProfileErr("Enter a valid email address"); return; }
    }
    setProfileSaving(true); setProfileErr("");
    try {
      const payload = { city: profileForm.city.trim(), area: profileForm.area.trim(), phone: profileForm.phone.trim() };
      if (hasPlaceholderEmail) payload.email = profileForm.email.trim();
      await api("PUT", "/auth/update-profile", payload);
      setUserCity(profileForm.city.trim());
      setUserArea(profileForm.area.trim());
      await refreshUser(); // updates `user.city`/`user.phone`/`user.email` app-wide, which clears needsProfileCompletion
    } catch(e) { setProfileErr(e.message); }
    finally { setProfileSaving(false); }
  };

  const updateLocation = async (loc) => {
    setUserCity(loc.city); setUserArea(loc.area); setShowLocPicker(false);
    try { await api("PUT", "/auth/update-profile", { city:loc.city, area:loc.area }); } catch(e) { console.error(e); }
    try { const res = await api("GET", `/stores?city=${encodeURIComponent(loc.city)}`); setStores(res.stores||[]); } catch(e) { console.error(e); }
  };

  useEffect(() => { fetchStores(); }, [fetchStores]);
  useEffect(() => {
    api("GET", "/settings/public").then(res => setUpiEnabled(!!res.upiPaymentsEnabled)).catch(()=>{});
  }, []);
  // Safety net — if UPI gets disabled by an admin while someone already
  // has "Pay Online" selected mid-booking, silently fall back to cash
  // rather than let a hidden/stale selection reach the booking request.
  useEffect(() => {
    if (!upiEnabled && paymentMethod === "upi") setPaymentMethod("cash");
  }, [upiEnabled, paymentMethod]);
  // Same idea, for variable-priced services — if a customer already
  // had "Pay Online", wallet credit, or an offer selected and THEN adds
  // a variable-priced service to the same booking, those choices are
  // now hidden from the UI but could otherwise still be sitting in
  // state. Reset them the moment that happens, not just when the
  // payment section first renders.
  useEffect(() => {
    if (!hasVariablePriceSelected) return;
    if (paymentMethod === "upi") setPaymentMethod("cash");
    if (useWallet) setUseWallet(false);
    if (selectedOffer) setSelectedOffer(null);
  }, [hasVariablePriceSelected]);
  useEffect(() => { fetchMyBookings(); }, []);
  useEffect(() => { fetchFavorites(); }, []);
  useEffect(() => { if(tab==="bookings") fetchMyBookings(); }, [tab]);
  useEffect(() => { sessionStorage.setItem("sloty-customer-tab", tab); }, [tab]);
  // Fetch active offers whenever a new store is opened — resets the
  // previously selected offer too, so an offer from a different store
  // can never carry over into a new booking flow.
  useEffect(() => {
    setSelectedOffer(null);
    if (!selStore?._id) { setStoreOffers([]); return; }
    api("GET", `/offers/store/${selStore._id}`)
      .then(res => setStoreOffers(res.offers || []))
      .catch(() => setStoreOffers([]));
  }, [selStore?._id]);

  // Real-time: join this customer's personal room so "your turn", booking
  // status changes, and location-aware reminders arrive instantly instead
  // of waiting for the next poll. Plays Sloty's own chime while the app
  // is open (background push uses the OS's default sound — that part
  // can't be customized from a website).
  useEffect(() => {
    const socket = getSocket();
    joinRoom(`user:${user.id}`);

    const onStatus = (payload) => {
      playChime();
      const labels = { in_progress:"Your turn has started! 🎯", completed:"Visit complete — thank you! ✅", no_show:"You missed your slot", cancelled:"Booking cancelled" };
      showToast(labels[payload.status] || `Booking updated at ${payload.storeName||"store"}`, payload.status==="no_show"?"error":"success");
      fetchMyBookings();
    };
    const onReminder = (payload) => {
      playChime();
      showToast(`Time to head to ${payload.storeName}! ⏰`);
    };
    socket.on("booking:status", onStatus);
    socket.on("reminder", onReminder);

    return () => {
      leaveRoom(`user:${user.id}`);
      socket.off("booking:status", onStatus);
      socket.off("reminder", onReminder);
    };
  }, [user.id]);

  // While viewing My Bookings, also join each relevant store's live-queue
  // room so "X ahead of you" updates the instant something changes,
  // instead of waiting for the 20s poll.
  useEffect(() => {
    if (tab !== "bookings") return;
    const today = getISTDateString();
    const storeIds = [...new Set(
      myBookings.filter(b => b.status==="confirmed" && b.date===today && b.store?._id).map(b => b.store._id)
    )];
    const socket = getSocket();
    const rooms = storeIds.map(id => `store:${id}:${today}`);
    rooms.forEach(joinRoom);

    const onQueueUpdate = () => { playSoftPing(); refreshQueuePositions(myBookings); };
    socket.on("queue:update", onQueueUpdate);

    return () => {
      rooms.forEach(leaveRoom);
      socket.off("queue:update", onQueueUpdate);
    };
  }, [tab, myBookings]);

  useEffect(() => {
    if (tab !== "bookings") return;
    refreshQueuePositions(myBookings);
  }, [tab, myBookings]);
  useEffect(() => {
    if (selStore && dates[selDateIdx] && selServices.length > 0 && (!needsStaff || selStaff)) {
      setSlots([]);
      const dateStr = getISTDateString(dates[selDateIdx]);
      fetchSlots(selStore._id, dateStr, totalServiceDuration || 30, selStaff?._id);
    }
  }, [selStore, selDateIdx, selServices, selStaff]);

  // Broadens the raw typed query using SEARCH_SYNONYMS — e.g. "dental"
  // expands to also match the "dentist" category and related keywords
  // like "teeth"/"tooth", and "oil" expands to match both bike AND car
  // mechanic categories, not just a literal "Oil Change" service name.
  const { categories: expandedCats, keywords: expandedKeywords } = expandSearchQuery(search);

  const filtStores = stores.filter(s => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q
      || s.name.toLowerCase().includes(q)
      || (s.services||[]).some(sv => sv.name.toLowerCase().includes(q))
      || expandedCats.includes(s.category)
      || expandedKeywords.some(k => s.name.toLowerCase().includes(k) || (s.services||[]).some(sv => sv.name.toLowerCase().includes(k)));
    return (!selGroup || selGroup.categoryIds.includes(s.category))
      && (!selCat  || s.category===selCat.id)
      && matchesSearch
      && (filter==="All" || (filter==="Open"&&s.isOpen) || (filter==="Top Rated"&&s.rating>=4.5));
  }).map(s => ({
    ...s,
    distanceKm: myLocation && s.location?.lat ? haversineKm(myLocation.lat, myLocation.lng, s.location.lat, s.location.lng) : null,
  }));

  // When actively searching, boost results in the customer's own saved
  // area to the top — "dental" should surface Kukatpally dentists
  // before ones clear across the city, even though both are shown.
  // Nearest-first (GPS-based) sort still takes priority when it's on,
  // since it's a stronger, more precise relevance signal than the
  // coarser saved-area match.
  const sortedStores = sortNearest
    ? [...filtStores].sort((a,b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    : search.trim() && userArea
      ? [...filtStores].sort((a,b) => {
          const aMatch = (a.area||"").toLowerCase() === userArea.toLowerCase() ? 0 : 1;
          const bMatch = (b.area||"").toLowerCase() === userArea.toLowerCase() ? 0 : 1;
          return aMatch - bMatch;
        })
      : filtStores;

  const storesByArea = sortedStores.reduce((acc, store) => {
    const area = store.area||store.city||"Other";
    if (!acc[area]) acc[area] = [];
    acc[area].push(store);
    return acc;
  }, {});

  const book = async () => {
    if (selServices.length===0||!selSlot) return;
    if (needsStaff && !selStaff) return;
    setLoading(true); setErr("");

    try {
      const res = await api("POST", "/bookings", {
        storeId: selStore._id,
        services: selServices.map(s => ({ name:s.name, price:s.price, duration:s.duration })),
        staffId: selStaff?._id,
        date: getISTDateString(dates[selDateIdx]),
        timeSlot: selSlot, paymentMode: paymentMethod, useWallet, offerId: selectedOffer,
      });

      // Attaches the customer's location after the booking already
      // exists, purely for the "time to head out" reminder feature —
      // deliberately NOT awaited. The customer sees their booking
      // confirmed immediately; this fills in the reminder-timing detail
      // in the background over the next second or two. If it fails or
      // never arrives (denied permission, they close the tab fast), the
      // reminder job simply falls back to its default lead time — same
      // graceful fallback this already had before, just no longer
      // something the customer has to wait through first.
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            api("PUT", `/bookings/${res.booking._id}/location`, {
              lat: pos.coords.latitude, lng: pos.coords.longitude,
            }).catch(() => {}); // best-effort — a failure here shouldn't surface to the customer at all
          },
          () => {}, // permission denied/unavailable — silently skip, exactly as before
          { timeout: 3000 }
        );
      }

      if (paymentMethod === "upi" && res.booking.paymentStatus === "pending") {
        // Slot is now reserved (same atomic capacity logic as any
        // booking) — start the payment step instead of jumping straight
        // to confirmation. If the customer abandons this step, the
        // booking stays reserved but unpaid; existing no-show handling
        // already covers cleaning up bookings that never get honored.
        const orderRes = await api("POST", "/payments/create-order", { bookingId: res.booking._id });
        setPendingPayment({
          booking: res.booking,
          order: orderRes.order,
          devMode: orderRes.devMode,
          keyId: orderRes.keyId,
          walletDeducted: res.walletDeducted || 0,
        });
      } else {
        setConfirmed({ ...res.booking, walletDeducted: res.walletDeducted || 0 }); setScreen("confirmed"); fetchMyBookings();
      }
    } catch(e) { setErr(e.message); } finally { setLoading(false); }
  };

  // Completes payment for a booking created with paymentMethod:"upi".
  // In dev mode (no real Razorpay credentials configured on the
  // backend), this simulates success locally. In real mode, it opens
  // Razorpay's actual checkout modal and only confirms the booking
  // after the backend independently verifies the payment signature —
  // never trusting the frontend's word alone that payment succeeded.
  const completePayment = async () => {
    if (!pendingPayment) return;
    setErr("");

    if (pendingPayment.devMode) {
      setPayingNow(true);
      try {
        const verifyRes = await api("POST", "/payments/verify", {
          bookingId: pendingPayment.booking._id,
          razorpay_order_id: pendingPayment.order.id,
        });
        setConfirmed({ ...verifyRes.booking, walletDeducted: pendingPayment.walletDeducted });
        setPendingPayment(null);
        setScreen("confirmed");
        fetchMyBookings();
      } catch(e) { setErr(e.message); }
      finally { setPayingNow(false); }
      return;
    }

    if (!window.Razorpay) {
      setErr("Payment system is still loading — please try again in a moment.");
      return;
    }

    const rzp = new window.Razorpay({
      key: pendingPayment.keyId,
      amount: pendingPayment.order.amount,
      currency: "INR",
      order_id: pendingPayment.order.id,
      name: "Sloty",
      description: selServices.map(s=>s.name).join(" + "),
      handler: async (response) => {
        setPayingNow(true);
        try {
          const verifyRes = await api("POST", "/payments/verify", {
            bookingId: pendingPayment.booking._id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setConfirmed({ ...verifyRes.booking, walletDeducted: pendingPayment.walletDeducted });
          setPendingPayment(null);
          setScreen("confirmed");
          fetchMyBookings();
        } catch(e) { setErr(e.message); }
        finally { setPayingNow(false); }
      },
      theme: { color: C.pri },
    });
    rzp.open();
  };

  // Lets the customer back out of the payment screen without losing
  // their reserved slot — switches the booking to pay-at-store instead
  // of leaving it silently stuck in a "pending UPI payment" limbo.
  const switchPendingBookingToCash = async () => {
    if (!pendingPayment) return;
    setSwitchingToCash(true); setErr("");
    try {
      await api("PUT", "/payments/switch-to-cash", { bookingId: pendingPayment.booking._id });
      setConfirmed({ ...pendingPayment.booking, paymentMode:"cash", walletDeducted: pendingPayment.walletDeducted });
      setPendingPayment(null);
      setScreen("confirmed");
      fetchMyBookings();
    } catch(e) {
      setErr(e.message);
    } finally {
      setSwitchingToCash(false);
    }
  };

  const BOTTOM_TABS = [["","Home","home"],["","Explore","explore"],["","Bookings","bookings"],["","Profile","profile"]];
  const onNavChange = t => { setTab(t); setScreen("home"); if(t==="explore"){setSelCat(null);setSelGroup(null);setSearch("");setScreen("stores");fetchStores();} };

  const ToastEl = toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />;

  // ── Review bottom sheet (rendered globally, opens over any screen) ──────
  const ReviewSheet = (
    <BottomSheet open={!!reviewModal} onClose={() => setReviewModal(null)} title="Rate your experience">
      {reviewModal && (
        <div>
          <p style={{ fontSize:13, color:C.muted, textAlign:"center", marginBottom:4 }}>How was your visit to</p>
          <p style={{ fontSize:16, fontWeight:900, color:C.text, textAlign:"center", marginBottom:18 }}>{reviewModal.store?.name}</p>
          <StarRow value={reviewRating} onChange={setReviewRating} />
          <textarea
            value={reviewComment}
            onChange={e=>setReviewComment(e.target.value)}
            placeholder="Tell us about your experience (optional)"
            rows={3}
            style={{ width:"100%", padding:"13px 16px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, color:C.text, background:C.inputBg, outline:"none", fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", resize:"none", marginBottom:16 }}
          />
          <Btn onClick={submitReview} disabled={reviewRating===0 || reviewSubmitting}>
            {reviewSubmitting ? "Submitting..." : reviewRating===0 ? "Select a rating" : "Submit Review"}
          </Btn>
        </div>
      )}
    </BottomSheet>
  );

  const CancelSheet = (
    <BottomSheet open={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancel this booking?">
      {cancelModal && (() => {
        // Mirrors the backend's exact refund policy so the customer
        // sees an accurate preview before confirming, not just finding
        // out the outcome afterward. REFUND_NOTICE_HOURS here must
        // match the same constant in bookingController.js — currently
        // 0 (always refund), paused from its original value of 2.
        const REFUND_NOTICE_HOURS = 0;
        let refundPreview = null;
        if (cancelModal.paymentMode === "upi" && cancelModal.paymentStatus === "paid") {
          const upiPaidAmount = Math.max(0, (cancelModal.service?.price||0) - (cancelModal.walletDeducted||0));
          if (upiPaidAmount > 0) {
            const [timePart, period] = cancelModal.timeSlot.split(" ");
            let [h, m] = timePart.split(":").map(Number);
            if (period === "PM" && h !== 12) h += 12;
            if (period === "AM" && h === 12) h = 0;
            const slotTime = new Date(`${cancelModal.date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+05:30`);
            const hoursLeft = (slotTime.getTime() - Date.now()) / (1000*60*60);
            refundPreview = hoursLeft >= REFUND_NOTICE_HOURS
              ? { ok:true, text:`You'll get ₹${upiPaidAmount} credited to your Sloty wallet.` }
              : { ok:false, text:`This is within ${REFUND_NOTICE_HOURS} hours of your slot — no refund will be issued.` };
          }
        }
        return (
        <div>
          <p style={{ fontSize:13, color:C.muted, marginBottom:16, lineHeight:1.5 }}>
            {cancelModal.store?.name || "This store"} · {cancelModal.date} · {cancelModal.timeSlot}
          </p>
          {refundPreview && (
            <div style={{ background:refundPreview.ok?C.green+"12":C.red+"12", border:`1.5px solid ${refundPreview.ok?C.green:C.red}33`, borderRadius:12, padding:"10px 14px", marginBottom:16 }}>
              <p style={{ fontSize:12, fontWeight:700, color:refundPreview.ok?C.green:C.red }}>{refundPreview.text}</p>
            </div>
          )}
          <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:10 }}>Why are you cancelling?</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
            {CANCEL_REASONS.map(r => (
              <button
                key={r}
                onClick={() => setCancelReason(r)}
                style={{ padding:"8px 14px", borderRadius:20, border:`1.5px solid ${cancelReason===r?C.pri:"#E8ECF5"}`, background:cancelReason===r?C.pri+"12":C.card, color:cancelReason===r?C.pri:C.muted, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}
              >
                {r}
              </button>
            ))}
          </div>
          {cancelReason === "Other" && (
            <Input
              placeholder="Tell us more (optional)"
              value={cancelReasonOther}
              onChange={e => setCancelReasonOther(e.target.value)}
              style={{ marginBottom:14 }}
            />
          )}
          <Btn onClick={confirmCancelBooking} disabled={cancelling || !cancelReason} color={C.red}>
            {cancelling ? "Cancelling..." : "Confirm Cancellation"}
          </Btn>
        </div>
        );
      })()}
    </BottomSheet>
  );

  const RescheduleSheet = (
    <BottomSheet open={!!rescheduleModal} onClose={() => setRescheduleModal(null)} title="Change your slot">
      {rescheduleModal && (
        <div>
          <p style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
            {rescheduleModal.store?.name || "This store"} · currently {rescheduleModal.date} · {rescheduleModal.timeSlot}
          </p>
          <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:10 }}>Pick a new date</p>
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:16 }}>
            {rescheduleDates.map((d,i) => (
              <div
                key={i}
                onClick={() => { setRescheduleDateIdx(i); setRescheduleSlot(null); }}
                style={{ minWidth:54, textAlign:"center", padding:"11px 6px", borderRadius:14, cursor:"pointer", background:rescheduleDateIdx===i?`linear-gradient(135deg,${C.pri},#E0406A)`:C.inputBg, flexShrink:0 }}
              >
                <div style={{ fontSize:9, fontWeight:800, color:rescheduleDateIdx===i?"rgba(255,255,255,0.8)":C.muted }}>{i===0?"TODAY":DAY[getISTDay(d)]}</div>
                <div style={{ fontSize:20, fontWeight:900, color:rescheduleDateIdx===i?"#fff":C.text }}>{getISTDateNum(d)}</div>
                <div style={{ fontSize:9, color:rescheduleDateIdx===i?"rgba(255,255,255,0.7)":C.muted }}>{MON[getISTMonthIdx(d)]}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:10 }}>Pick a new time</p>
          {!rescheduleDayClosure.isWholeDayClosed && rescheduleSlots.length > 0 && (
            <p style={{ fontSize:11, color:C.muted, marginBottom:10, fontWeight:700 }}>
              {rescheduleSlots.filter(s => s.available).length} slots available
            </p>
          )}
          <SlotPicker
            slots={rescheduleSlots}
            selected={rescheduleSlot}
            onSelect={setRescheduleSlot}
            loading={rescheduleSlotsLoading}
            isWholeDayClosed={rescheduleDayClosure.isWholeDayClosed}
            closureReason={rescheduleDayClosure.closureReason}
          />

          <div style={{ marginTop:18 }}>
            <Btn onClick={confirmReschedule} disabled={rescheduling || !rescheduleSlot}>
              {rescheduling ? "Saving..." : "Confirm New Slot"}
            </Btn>
          </div>
        </div>
      )}
    </BottomSheet>
  );

  if (legalOverlay === "terms")   return <TermsOfService onBack={() => setLegalOverlay(null)} />;
  if (legalOverlay === "privacy") return <PrivacyPolicy onBack={() => setLegalOverlay(null)} />;

  if (showSettings) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:40 }}>
      <TopBar title="Settings" sub="Sloty" onBack={() => setShowSettings(false)} />
      <div style={{ padding:20 }}><CustomerSettings user={user} onLogout={logout} onOpenLegal={setLegalOverlay} /></div>
    </div>
  );

  if (showLocPicker) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif" }}>
      <TopBar title="Change Location" sub="Sloty" onBack={() => setShowLocPicker(false)} />
      <div style={{ padding:20 }}>
        <Card>
          <LocationDetector onDetected={loc=>updateLocation(loc)} />
          <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginBottom:12 }}>— or search your city —</p>
          <MapPicker initialCity={userCity} onSelect={loc=>updateLocation(loc)} />
        </Card>
      </div>
    </div>
  );

  // ── Complete Payment ──────────────────────────────────────────────────────
  // Shown right after a booking is reserved with paymentMethod:"upi" —
  // blocks other screens until the customer either completes or
  // abandons payment, since the slot is already held and this needs
  // clear resolution one way or the other.
  if (pendingPayment) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.card, borderRadius:24, padding:28, width:"100%", maxWidth:380, textAlign:"center" }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
          <IndianRupee size={28} color={C.pri} />
        </div>
        <h2 style={{ fontSize:18, fontWeight:900, color:C.text, marginBottom:6 }}>Complete Payment</h2>
        <p style={{ fontSize:13, color:C.muted, marginBottom:4 }}>Your slot is reserved for a few minutes.</p>
        <p style={{ fontSize:26, fontWeight:900, color:C.pri, margin:"16px 0" }}>₹{(pendingPayment.order.amount/100).toFixed(0)}</p>

        {pendingPayment.devMode && (
          <div style={{ background:C.acc+"15", borderRadius:12, padding:"10px 14px", marginBottom:16, textAlign:"left" }}>
            <p style={{ fontSize:11, color:"#B8860B", fontWeight:700 }}>
              DEV MODE — no real Razorpay account connected yet. This simulates a successful payment instead of charging anything real.
            </p>
          </div>
        )}

        {err && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginBottom:12 }}>{err}</p>}

        <Btn onClick={completePayment} disabled={payingNow}>
          {payingNow ? "Processing..." : pendingPayment.devMode ? "Simulate Successful Payment" : "Pay Now"}
        </Btn>
        <button
          onClick={switchPendingBookingToCash}
          disabled={payingNow || switchingToCash}
          style={{ width:"100%", padding:"12px", marginTop:10, background:"transparent", border:"none", color:C.muted, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}
        >
          {switchingToCash ? "Switching..." : "Cancel — I'll pay at the store instead"}
        </button>
      </div>
    </div>
  );

  // ── Profile Completion Gate ──────────────────────────────────────────────
  // Placed BEFORE every other screen conditional (Home, Stores, Bookings,
  // Profile, etc.) so it genuinely blocks the whole app until a new
  // customer's profile is complete — not just scoped to whichever screen
  // happens to render first. Matters most for Google Sign-In, which
  // never collects a phone number at all.
  if (needsProfileCompletion) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:C.card, borderRadius:"28px 28px 0 0", padding:"28px 24px 40px", width:"100%", maxWidth:440 }}>
        <div style={{ width:40, height:4, borderRadius:4, background:"#E0E4EF", margin:"0 auto 20px" }} />
        <h2 style={{ fontSize:20, fontWeight:900, color:C.text, marginBottom:6 }}>Complete your profile</h2>
        <p style={{ fontSize:13, color:C.muted, marginBottom:24 }}>We need a few details to show stores near you and confirm bookings.</p>

        <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:6 }}>PHONE NUMBER</p>
        <div style={{ display:"flex", alignItems:"center", gap:10, border:"2px solid #E8ECF5", borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
          <Phone size={16} color={C.pri} />
          <input value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value.replace(/\D/g,"").slice(0,10) }))} placeholder="10-digit mobile number" maxLength={10} style={{ flex:1, border:"none", outline:"none", fontSize:14, fontFamily:"'Nunito',sans-serif", color:C.text }} />
        </div>

        {hasPlaceholderEmail && (
          <>
            <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:6 }}>EMAIL ADDRESS</p>
            <div style={{ display:"flex", alignItems:"center", gap:10, border:"2px solid #E8ECF5", borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
              <Mail size={16} color={C.pri} />
              <input value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} placeholder="your.email@example.com" type="email" style={{ flex:1, border:"none", outline:"none", fontSize:14, fontFamily:"'Nunito',sans-serif", color:C.text }} />
            </div>
            <p style={{ fontSize:11, color:C.acc, fontWeight:700, marginTop:-8, marginBottom:16, display:"flex", alignItems:"center", gap:5 }}>
              We'll use this for booking confirmations and receipts.
            </p>
          </>
        )}

        <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:6 }}>LOCATION</p>
        <LocationDetector onDetected={loc => setProfileForm(p => ({ ...p, city: loc.city || p.city, area: loc.area || p.area }))} />
        <p style={{ fontSize:11, color:C.muted, marginTop:6, marginBottom:16 }}>Or enter manually below</p>

        <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:6 }}>CITY</p>
        <div style={{ display:"flex", alignItems:"center", gap:10, border:"2px solid #E8ECF5", borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
          <MapPin size={16} color={C.pri} />
          <input value={profileForm.city} onChange={e => setProfileForm(p => ({ ...p, city: e.target.value }))} placeholder="Your city" style={{ flex:1, border:"none", outline:"none", fontSize:14, fontFamily:"'Nunito',sans-serif", color:C.text }} />
        </div>

        <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:6 }}>AREA / LOCALITY <span style={{ color:C.muted, fontWeight:600 }}>(optional)</span></p>
        <div style={{ display:"flex", alignItems:"center", gap:10, border:"2px solid #E8ECF5", borderRadius:12, padding:"12px 14px", marginBottom:20 }}>
          <MapPin size={16} color={C.muted} />
          <input value={profileForm.area} onChange={e => setProfileForm(p => ({ ...p, area: e.target.value }))} placeholder="e.g. Kukatpally, Banjara Hills" style={{ flex:1, border:"none", outline:"none", fontSize:14, fontFamily:"'Nunito',sans-serif", color:C.text }} />
        </div>

        {profileErr && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginBottom:12 }}>{profileErr}</p>}

        <button onClick={saveProfileCompletion} disabled={profileSaving} style={{ width:"100%", padding:"15px", background:profileSaving?"#E0E4EF":`linear-gradient(100deg,${C.pri},#DB2777)`, color:profileSaving?"#AAB":"#fff", border:"none", borderRadius:14, fontSize:15, fontWeight:800, cursor:profileSaving?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif" }}>
          {profileSaving ? "Saving..." : "Save & Continue →"}
        </button>
      </div>
    </div>
  );

  // ── Home ──────────────────────────────────────────────────────────────────
  if (screen==="home" && tab==="home") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:100 }}>
      {ToastEl}
      <div style={{ background:`linear-gradient(135deg,${C.pri} 0%,#C0304A 100%)`, padding:"48px 20px 20px", borderBottomLeftRadius:36, borderBottomRightRadius:36 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <button onClick={() => setShowLocPicker(true)} style={{ background:"rgba(255,255,255,0.18)", border:"none", borderRadius:20, padding:"5px 14px", color:"rgba(255,255,255,0.9)", fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <MapPin size={13} color="rgba(255,255,255,0.9)" />
              {userArea?`${userArea}, ${userCity}`:userCity||"Set Location"}
              <ChevronDown size={13} color="rgba(255,255,255,0.7)" />
            </button>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.7)", marginBottom:1 }}>Good day,</p>
            <h1 style={{ fontSize:22, fontWeight:900, color:"#fff", textShadow:"0 2px 8px rgba(0,0,0,0.18)" }}>{user.name?.split(" ")[0]}</h1>
          </div>
          <div onClick={() => {setTab("profile");setScreen("home");}} style={{ width:46, height:46, borderRadius:"50%", background:"rgba(255,255,255,0.2)", border:"2px solid rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#fff", fontWeight:900, fontSize:18 }}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
        </div>
        <div style={{ position:"relative" }}>
          <div style={{ background:C.card, borderRadius:16, padding:"13px 18px", display:"flex", gap:14, alignItems:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.15)" }}>
            <Search size={18} color={C.muted} />
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              onFocus={()=>setShowSearchSuggestions(true)}
              onBlur={()=>setTimeout(()=>setShowSearchSuggestions(false), 150)}
              onKeyDown={e=>{ if(e.key==="Enter" && search.trim()){ setSelCat(null); setScreen("stores"); fetchStores(); setShowSearchSuggestions(false); } }}
              placeholder={`Search salons, mechanics in ${userCity||"your city"}...`}
              style={{ flex:1, border:"none", fontSize:14, color:C.text, outline:"none", background:"transparent", fontFamily:"'Nunito',sans-serif" }}
            />
            {search && <div onClick={()=>setSearch("")} style={{ cursor:"pointer", display:"flex" }}><X size={16} color={C.muted} /></div>}
          </div>
          {/* Search suggestions dropdown. Each suggestion uses
              onMouseDown (not onClick) with preventDefault — this stops
              the input from ever blurring in the first place when a
              suggestion is tapped, rather than racing a delayed blur
              against the tap. onClick alone was unreliable on touch
              devices: the input's blur could fire and hide this dropdown
              before the tap was ever processed as a click, so the
              suggestion visibly disappeared without doing anything. */}
          {showSearchSuggestions && search.trim().length >= 2 && (() => {
            const suggestions = getSearchSuggestions(search, stores);
            if (suggestions.length === 0) return null;
            return (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:C.card, borderRadius:16, boxShadow:"0 8px 28px rgba(0,0,0,0.18)", zIndex:20, overflow:"hidden" }}>
                {suggestions.map((s,i) => (
                  <div
                    key={i}
                    onMouseDown={e => { e.preventDefault(); setSearch(s.label); setSelCat(null); setScreen("stores"); fetchStores(); setShowSearchSuggestions(false); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", cursor:"pointer", borderBottom:i<suggestions.length-1?"1px solid #F0F2F8":"none" }}
                  >
                    <Search size={13} color={C.muted} />
                    <span style={{ fontSize:13, color:C.text, fontWeight:600, flex:1 }}>{s.label}</span>
                    {s.type!=="term" && (
                      <span style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{s.type}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{ padding:"20px 0 0" }}>
        <div style={{ padding:"0 16px", marginBottom:14 }}>
          <h2 style={{ fontSize:17, fontWeight:900, color:C.text }}>What do you need?</h2>
        </div>
        {/* Grouped categories — each section heading is a group (Health,
            Mechanic & Repair, Beauty & Grooming), with the individual
            categories inside it shown as their own icons underneath. */}
        {GROUPS.map(group => (
          <div key={group.id} style={{ marginBottom:22 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"0 16px", marginBottom:14 }}>
              <group.Icon size={16} color={group.color} strokeWidth={2} />
              <h3 style={{ fontSize:14, fontWeight:900, color:C.text }}>{group.name}</h3>
            </div>
            <div style={{ display:"flex", gap:12, overflowX:"auto", paddingLeft:16, paddingRight:16, paddingBottom:8, scrollbarWidth:"none" }}>
              {group.categoryIds.map(catId => {
                const cat = getCat(catId);
                const isActive = selCat?.id===cat.id;
                return (
                  <div key={cat.id} onClick={() => {setSelGroup(group);setSelCat(cat);setSearch("");setScreen("stores");fetchStores();}} style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:8, cursor:"pointer" }}>
                    <div style={{ width:80, height:80, borderRadius:22, background:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:isActive?`0 8px 24px ${cat.color}55`:"0 2px 12px rgba(0,0,0,0.10)", transition:"all 0.2s", border:isActive?`2.5px solid ${cat.color}`:"2px solid transparent" }}>
                      <CategoryIllustration categoryId={cat.id} size={66} />
                    </div>
                    <span style={{ fontSize:11, fontWeight:800, color:isActive?cat.color:C.text, textAlign:"center", width:84, lineHeight:1.4 }}>{cat.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ padding:"8px 16px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <h2 style={{ fontSize:17, fontWeight:900, color:C.text }}>Stores near you</h2>
            <span onClick={() => {setSelCat(null);setSelGroup(null);setScreen("stores");fetchStores();}} style={{ fontSize:12, color:C.pri, fontWeight:700, cursor:"pointer" }}>See All</span>
          </div>
          {loading ? <Loader skeleton /> : stores.length===0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ width:64, height:64, borderRadius:20, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}><Search size={28} color={C.pri} /></div>
              <p style={{ fontSize:15, fontWeight:800, color:C.text }}>No stores found in {userCity}</p>
              <p style={{ fontSize:13, color:C.muted, marginTop:8 }}>Try changing your location</p>
              <button onClick={() => setShowLocPicker(true)} style={{ marginTop:16, padding:"12px 24px", background:`linear-gradient(135deg,${C.pri},#E0406A)`, color:"#fff", border:"none", borderRadius:12, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"inline-flex", alignItems:"center", gap:8 }}>
                <MapPin size={14} color="#fff" /> Change Location
              </button>
            </div>
          ) : Object.entries(storesByArea).slice(0,3).map(([area,areaStores]) => (
            <div key={area}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, marginTop:4 }}>
                <MapPin size={14} color={C.pri} />
                <h3 style={{ fontSize:15, fontWeight:900, color:C.text }}>{area}</h3>
                <div style={{ flex:1, height:1, background:"#E8ECF5" }} />
                <span style={{ fontSize:11, color:C.muted }}>{areaStores.length} stores</span>
              </div>
              {areaStores.slice(0,2).map(store => (
                <StoreCard
                  key={store._id}
                  store={store}
                  onSelect={(s) => { setSelStore(s); setScreen("detail"); }}
                  onBook={openBooking}
                  isFavorite={favoriteIds.has(store._id)}
                  onToggleFavorite={toggleFavorite}
                  onShare={shareStore}
                  distanceLabel={formatDistance(store.distanceKm)}
                  offer={storeOffersMap[store._id]}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Floating AI booking assistant launcher. The app's visual
          container is a fixed 440px column centered on screen (via
          left:50% + translateX elsewhere in this file) — so this
          button uses the SAME convention: left:50% + a translateX
          computed to land it 16px from the container's right edge
          (220 half-width - 16 margin - 54 button width = 150), which
          stays correct regardless of actual browser/viewport width,
          unlike a `right:` offset which is relative to the full
          viewport and breaks on desktop. bottom:96 clears BottomNav
          (~90px tall) with a clean 16px extra gap above it. */}
      <button
        onClick={() => setShowAssistant(true)}
        style={{
          position:"fixed", bottom:96, left:"50%", transform:"translateX(150px)",
          width:54, height:54, borderRadius:"50%",
          background:`linear-gradient(100deg,${C.pri},#DB2777)`,
          border:"none", boxShadow:`0 8px 24px ${C.pri}55`,
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", zIndex:90, transition:"transform 0.15s ease",
        }}
      >
        <Sparkles size={22} color="#fff" />
      </button>
      <BookingAssistant open={showAssistant} onClose={() => setShowAssistant(false)} />

      <BottomNav tabs={BOTTOM_TABS} active={tab} onChange={onNavChange} />
    </div>
  );

  // ── Stores List ───────────────────────────────────────────────────────────
  if (screen==="stores") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:100 }}>
      {ToastEl}
      <TopBar title={selCat?.name||selGroup?.name||"All Services"} sub={userArea||userCity||"Near You"} onBack={() => {setScreen("home");setTab("home");setSelCat(null);setSelGroup(null);setSearch("");}} />
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ background:C.card, borderRadius:14, padding:"12px 16px", display:"flex", gap:10, alignItems:"center", marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
          <Search size={16} color={C.muted} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stores..." style={{ flex:1, border:"none", fontSize:13, outline:"none", background:"transparent", fontFamily:"'Nunito',sans-serif" }} />
          {search && <div onClick={()=>setSearch("")} style={{ display:"flex", cursor:"pointer" }}><X size={14} color={C.muted} /></div>}
        </div>
        {selGroup && (
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:10, scrollbarWidth:"none" }}>
            <button onClick={() => setSelCat(null)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:`1.5px solid ${!selCat?selGroup.color:"#E8ECF5"}`, cursor:"pointer", background:!selCat?selGroup.color+"15":"#fff", color:!selCat?selGroup.color:C.muted, fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>
              All {selGroup.name}
            </button>
            {selGroup.categoryIds.map(catId => {
              const c = getCat(catId);
              const isActive = selCat?.id === catId;
              return (
                <button key={catId} onClick={() => setSelCat(c)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:`1.5px solid ${isActive?selGroup.color:"#E8ECF5"}`, cursor:"pointer", background:isActive?selGroup.color+"15":"#fff", color:isActive?selGroup.color:C.muted, fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8 }}>
          {["All","Open","Top Rated"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ flexShrink:0, padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer", background:filter===f?C.pri:"#fff", color:filter===f?"#fff":C.muted, fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>{f}</button>
          ))}
          <button onClick={async () => { if (!sortNearest) await ensureMyLocation(); setSortNearest(v=>!v); }} style={{ flexShrink:0, padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer", background:sortNearest?C.blue:"#fff", color:sortNearest?"#fff":C.muted, fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:5 }}>
            <ArrowUpDown size={12} /> Nearest First
          </button>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <p style={{ fontSize:12, color:C.muted, fontWeight:700 }}>{filtStores.length} stores found</p>
          <div style={{ display:"flex", background:C.card, borderRadius:10, padding:3, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <button onClick={() => setViewMode("list")} style={{ padding:"5px 10px", borderRadius:8, border:"none", cursor:"pointer", background:viewMode==="list"?C.pri:"transparent", color:viewMode==="list"?"#fff":C.muted, display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>
              <ListIcon size={12} /> List
            </button>
            <button onClick={async () => { await ensureMyLocation(); setViewMode("map"); }} style={{ padding:"5px 10px", borderRadius:8, border:"none", cursor:"pointer", background:viewMode==="map"?C.pri:"transparent", color:viewMode==="map"?"#fff":C.muted, display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>
              <MapIconLucide size={12} /> Map
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding:"0 16px 16px" }}>
        {viewMode==="map" ? (
          <StoreMapView
            stores={sortedStores}
            userLocation={myLocation}
            onSelectStore={(s) => { setSelStore(s); setScreen("detail"); }}
          />
        ) : loading ? <Loader skeleton /> : filtStores.length===0 ? (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <div style={{ width:56, height:56, borderRadius:18, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}><Search size={24} color={C.pri} /></div>
            <p style={{ color:C.muted, fontWeight:700 }}>No stores found</p>
          </div>
        ) : Object.entries(storesByArea).map(([area,areaStores]) => (
          <div key={area}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, marginTop:8 }}>
              <MapPin size={13} color={C.pri} />
              <h3 style={{ fontSize:14, fontWeight:900, color:C.text }}>{area}</h3>
              <div style={{ flex:1, height:1, background:"#E8ECF5" }} />
            </div>
            {areaStores.map(store => (
              <StoreCard
                key={store._id}
                store={store}
                onSelect={(s) => { setSelStore(s); setScreen("detail"); }}
                onBook={openBooking}
                isFavorite={favoriteIds.has(store._id)}
                onToggleFavorite={toggleFavorite}
                onShare={shareStore}
                distanceLabel={formatDistance(store.distanceKm)}
                offer={storeOffersMap[store._id]}
              />
            ))}
          </div>
        ))}
      </div>
      <BottomNav tabs={BOTTOM_TABS} active={tab} onChange={onNavChange} />
    </div>
  );

  // ── Favorites ─────────────────────────────────────────────────────────────
  if (screen==="favorites") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:100 }}>
      {ToastEl}
      <TopBar title="My Favorites" sub={`${favStores.filter(s=>favoriteIds.has(s._id)).length} saved stores`} onBack={() => {setScreen("home");setTab("profile");}} />
      <div style={{ padding:"16px" }}>
        {favLoading ? <Loader skeleton /> : favStores.filter(s=>favoriteIds.has(s._id)).length===0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ width:72, height:72, borderRadius:24, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <Heart size={32} color={C.pri} />
            </div>
            <p style={{ fontSize:16, fontWeight:800, color:C.text }}>No favorites yet</p>
            <p style={{ fontSize:13, color:C.muted, marginTop:8 }}>Tap the heart on any store to save it here</p>
            <button onClick={() => {setTab("home");setScreen("stores");fetchStores();}} style={{ marginTop:20, padding:"12px 28px", background:`linear-gradient(135deg,${C.pri},#E0406A)`, color:"#fff", border:"none", borderRadius:14, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Explore Stores</button>
          </div>
        ) : favStores.filter(s=>favoriteIds.has(s._id)).map(store => (
          <StoreCard
            key={store._id}
            store={store}
            onSelect={(s) => { setSelStore(s); setScreen("detail"); }}
            onBook={openBooking}
            isFavorite={favoriteIds.has(store._id)}
            onToggleFavorite={toggleFavorite}
            onShare={shareStore}
            offer={storeOffersMap[store._id]}
          />
        ))}
      </div>
      <BottomNav tabs={BOTTOM_TABS} active={tab} onChange={onNavChange} />
    </div>
  );

  // ── Help & Support ────────────────────────────────────────────────────────
  if (screen==="help") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:100 }}>
      {ToastEl}
      <TopBar title="Help & Support" sub="We're here to help" onBack={() => {setScreen("home");setTab("profile");}} />
      <div style={{ padding:16 }}>

        {/* Contact options */}
        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          <a href="tel:+918317588958" style={{ flex:1, textDecoration:"none" }}>
            <div style={{ background:C.card, borderRadius:16, padding:"16px 10px", textAlign:"center", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ width:36, height:36, borderRadius:12, background:C.green+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px" }}>
                <Phone size={16} color={C.green} />
              </div>
              <p style={{ fontSize:11, fontWeight:800, color:C.text }}>Call Us</p>
            </div>
          </a>
          <a href="https://wa.me/918317588958" target="_blank" rel="noreferrer" style={{ flex:1, textDecoration:"none" }}>
            <div style={{ background:C.card, borderRadius:16, padding:"16px 10px", textAlign:"center", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ width:36, height:36, borderRadius:12, background:"#25D36615", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px" }}>
                <MessageCircle size={16} color="#25D366" />
              </div>
              <p style={{ fontSize:11, fontWeight:800, color:C.text }}>WhatsApp</p>
            </div>
          </a>
          <a href="mailto:support@sloty.app" style={{ flex:1, textDecoration:"none" }}>
            <div style={{ background:C.card, borderRadius:16, padding:"16px 10px", textAlign:"center", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ width:36, height:36, borderRadius:12, background:C.blue+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px" }}>
                <Mail size={16} color={C.blue} />
              </div>
              <p style={{ fontSize:11, fontWeight:800, color:C.text }}>Email</p>
            </div>
          </a>
        </div>

        {/* Report a problem */}
        <button onClick={() => setShowReportForm(true)} style={{ width:"100%", padding:"15px", background:`linear-gradient(135deg,${C.pri},#C0304A)`, color:"#fff", border:"none", borderRadius:14, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:24, boxShadow:`0 6px 20px ${C.pri}33` }}>
          <FileText size={16} /> Report a Problem
        </button>

        {/* My reported issues */}
        {myTickets.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <h3 style={{ fontSize:14, fontWeight:900, color:C.text, marginBottom:12 }}>Your Reports</h3>
            {myTickets.map(t => (
              <Card key={t._id}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <p style={{ fontSize:13, fontWeight:800, color:C.text, flex:1 }}>{t.subject}</p>
                  <Badge
                    color={t.status==="resolved"?C.green:t.status==="in_progress"?C.blue:C.acc}
                    text={t.status.replace("_"," ")}
                  />
                </div>
                <p style={{ fontSize:12, color:C.muted, marginBottom:6 }}>{t.message}</p>
                <p style={{ fontSize:10, color:C.muted }}>{new Date(t.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p>
              </Card>
            ))}
          </div>
        )}

        {/* FAQ */}
        <h3 style={{ fontSize:14, fontWeight:900, color:C.text, marginBottom:12 }}>Frequently Asked Questions</h3>
        {[
          { q:"How do I cancel a booking?", a:"Go to My Bookings, find the confirmed booking, and tap \"Cancel Booking\". This isn't available once your service has started. If you paid online, any refund is credited to your Sloty Wallet — check the cancellation screen for the exact amount before confirming." },
          { q:"Can I change my slot instead of cancelling?", a:"Yes — on any confirmed booking, tap \"Change Slot\" to pick a different date or time at the same store, without losing your place or needing to cancel and rebook from scratch." },
          { q:"What is the OTP for?", a:"It's shown right after you book. Show it to the store staff when you arrive — they'll enter it to mark your service as started." },
          { q:"What does \"X people ahead of you\" mean?", a:"While you're confirmed for today, this updates live to show how many people are still waiting before your turn at that store." },
          { q:"Can I choose a specific doctor or staff member?", a:"Yes — for stores with multiple staff (like hospitals with several doctors), you'll see a \"Select Doctor / Staff\" step during booking, with their specialization shown." },
          { q:"How do I pay?", a: upiEnabled ? "You can pay directly at the store (cash or UPI, whatever they accept), or prepay online via UPI at checkout — whichever you prefer." : "Currently, payment is made directly at the store — cash or UPI, whatever they accept." },
          { q:"Why does a service show \"On Inspection\" instead of a price?", a:"Some services — like PPF for a car, or repairs needing specific spare parts — genuinely can't be priced without seeing the vehicle first. These are booked at Pay at Store only, and the store will confirm the exact price once they've had a look." },
          { q:"What happens if I miss my slot?", a:"It'll be marked as a no-show by the store. You can simply book a new slot whenever you're ready." },
          { q:"How do reviews work?", a:"After a completed visit, open My Bookings and tap \"Rate your experience\" to leave a star rating and comment." },
          { q:"How do I list my own store on Sloty?", a:"Go back to the welcome screen and choose \"I'm a Store Owner\" to register. Your store goes live once approved by our team." },
        ].map((item, i) => (
          <div key={i} style={{ background:C.card, borderRadius:14, marginBottom:8, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
            <button onClick={() => setOpenFaq(openFaq===i?null:i)} style={{ width:"100%", padding:"14px 16px", background:"none", border:"none", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", textAlign:"left" }}>
              <span style={{ fontSize:13, fontWeight:800, color:C.text, flex:1 }}>{item.q}</span>
              {openFaq===i ? <ChevronUp size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
            </button>
            {openFaq===i && (
              <div style={{ padding:"0 16px 14px" }}>
                <p style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <BottomSheet open={showReportForm} onClose={() => setShowReportForm(false)} title="Report a Problem">
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:6 }}>CATEGORY</label>
          <select value={reportCategory} onChange={e=>setReportCategory(e.target.value)} style={{ width:"100%", padding:"12px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, background:C.inputBg, color:C.text, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box" }}>
            <option value="booking_issue">Booking Issue</option>
            <option value="payment_issue">Payment Issue</option>
            <option value="store_issue">Store / Service Issue</option>
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
        <Btn onClick={submitTicket} disabled={reportSubmitting}>
          {reportSubmitting ? "Submitting..." : <><Send size={15} style={{ marginRight:6, verticalAlign:"middle" }} /> Submit Report</>}
        </Btn>
      </BottomSheet>
    </div>
  );

  // ── Store Detail ──────────────────────────────────────────────────────────
  if (screen==="detail" && selStore) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:90 }}>
      <div style={{ height:200, backgroundImage:`url(${getStoreCover(selStore)})`, backgroundSize:"cover", backgroundPosition:"center", position:"relative" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 100%)" }} />
        <button aria-label="Go back" onClick={() => setScreen("stores")} style={{ position:"absolute", top:46, left:16, background:"rgba(255,255,255,0.95)", border:"none", borderRadius:12, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.15)", zIndex:2 }}>
          <ArrowLeft size={18} color="#1A1A2E" />
        </button>
        <button aria-label="Toggle favorite" onClick={() => toggleFavorite(selStore)} style={{ position:"absolute", top:46, right:16, background:"rgba(255,255,255,0.95)", border:"none", borderRadius:12, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.15)", zIndex:2 }}>
          <Heart size={18} color={favoriteIds.has(selStore._id) ? C.pri : "#1A1A2E"} fill={favoriteIds.has(selStore._id) ? C.pri : "none"} />
        </button>
        <button aria-label="Share this store" onClick={() => shareStore(selStore)} style={{ position:"absolute", top:46, right:62, background:"rgba(255,255,255,0.95)", border:"none", borderRadius:12, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.15)", zIndex:2 }}>
          <Share2 size={17} color="#1A1A2E" />
        </button>
        <div style={{ position:"absolute", bottom:16, left:16, right:16, zIndex:2 }}>
          <h2 style={{ fontSize:22, fontWeight:900, color:"#fff", marginBottom:6 }}>{selStore.name}</h2>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ background:selStore.isOpen?C.green:C.red, borderRadius:20, padding:"4px 12px", display:"flex", alignItems:"center", gap:5 }}>
              <Circle size={7} color="#fff" fill="#fff" />
              <span style={{ color:"#fff", fontWeight:800, fontSize:11 }}>{selStore.isOpen?"Open now":"Closed"}</span>
            </div>
            <span style={{ color:"rgba(255,255,255,0.8)", fontSize:12, fontWeight:700 }}>★ {selStore.rating}</span>
          </div>
        </div>
        {selStore.photos?.length > 1 && (
          <button onClick={() => setPhotoViewerIdx(0)} style={{ position:"absolute", bottom:16, right:16, background:"rgba(0,0,0,0.55)", border:"none", borderRadius:10, padding:"6px 12px", display:"flex", alignItems:"center", gap:5, cursor:"pointer", zIndex:2 }}>
            <ImageIcon size={13} color="#fff" />
            <span style={{ color:"#fff", fontSize:12, fontWeight:800 }}>{selStore.photos.length}</span>
          </button>
        )}
      </div>
      {selStore.photos?.length > 1 && (
        <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"12px 16px 0", scrollbarWidth:"none" }}>
          {selStore.photos.map((p,i) => (
            <img key={i} src={p} alt="" loading="lazy" onClick={() => setPhotoViewerIdx(i)} style={{ width:72, height:72, borderRadius:14, objectFit:"cover", flexShrink:0, cursor:"pointer", border:"2px solid #fff", boxShadow:"0 2px 8px rgba(0,0,0,0.1)" }} />
          ))}
        </div>
      )}
      <div style={{ padding:"16px 16px 100px" }}>
        <Card>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
            <StarRating rating={selStore.rating} size={16} />
            <span style={{ fontSize:12, color:C.muted, marginLeft:4 }}>{selStore.rating} · {selStore.totalReviews} reviews</span>
          </div>
          <InfoRow icon={MapPin} text={`${selStore.area?selStore.area+", ":""}${selStore.city}`} />
          <InfoRow icon={Home}   text={selStore.address} />
          <InfoRow icon={Phone}  text={selStore.phone} />
          <InfoRow icon={Clock}  text={`${selStore.workingHours?.open} – ${selStore.workingHours?.close}`} />
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <a href={getDirectionsUrl(selStore)} target="_blank" rel="noreferrer" style={{ textDecoration:"none", flex:1 }}>
            <div style={{ padding:"10px", background:C.blue+"12", color:C.blue, border:`1.5px solid ${C.blue}33`, borderRadius:10, fontWeight:800, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <Navigation size={13} /> Get Directions
            </div>
          </a>
          <button onClick={() => setShowChat(true)} style={{ flex:1, padding:"10px", background:C.pri+"12", color:C.pri, border:`1.5px solid ${C.pri}33`, borderRadius:10, fontWeight:800, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:"'Nunito',sans-serif" }}>
            <MessageCircle size={13} /> Message
          </button>
          </div>
        <CustomerChatModal open={showChat} onClose={() => setShowChat(false)} store={selStore} />
        </Card>

        {/* Active offers */}
        {storeOffers.length > 0 && (
          <Card>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <Tag size={16} color={C.pri} />
              <h3 style={{ fontSize:14, fontWeight:900, color:C.text }}>Offers for you</h3>
            </div>
            {storeOffers.map(o => (
              <div key={o._id} style={{ background:`linear-gradient(100deg,${C.pri}10,${C.pri}05)`, border:`1.5px dashed ${C.pri}44`, borderRadius:14, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                  {o.discountType==="free" ? (
                    <>
                      <Gift size={13} color={C.green} />
                      <span style={{ fontSize:14, fontWeight:900, color:C.green }}>FREE</span>
                    </>
                  ) : (
                    <>
                      {o.discountType==="percentage" ? <Percent size={13} color={C.pri} /> : <IndianRupee size={13} color={C.pri} />}
                      <span style={{ fontSize:14, fontWeight:900, color:C.pri }}>{o.discountType==="percentage"?`${o.discountValue}% OFF`:`₹${o.discountValue} OFF`}</span>
                    </>
                  )}
                </div>
                <p style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:2 }}>{o.title}</p>
                {o.description && <p style={{ fontSize:11, color:C.muted }}>{o.description}</p>}
                {o.minBookingValue > 0 && <p style={{ fontSize:10, color:C.muted, marginTop:4 }}>Min. booking value: ₹{o.minBookingValue}</p>}
              </div>
            ))}
          </Card>
        )}

        {/* Reviews section */}
        {selStore.reviews?.length > 0 && (
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Star size={16} color={C.acc} fill={C.acc} />
                <h3 style={{ fontSize:14, fontWeight:900, color:C.text }}>Reviews</h3>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:18, fontWeight:900, color:C.text }}>{selStore.rating}</span>
                <span style={{ fontSize:12, color:C.muted }}>/ 5 · {selStore.totalReviews} review{selStore.totalReviews!==1?"s":""}</span>
              </div>
            </div>
            {[...selStore.reviews].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5).map((r,i) => (
              <div key={i} style={{ paddingBottom:12, marginBottom:12, borderBottom: i<Math.min(selStore.reviews.length,5)-1?"1px solid #F0F2F8":"none" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:C.pri+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:C.pri }}>
                      {(r.name||"U").charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize:13, fontWeight:800, color:C.text }}>{r.name||"Customer"}</span>
                  </div>
                  <div style={{ display:"flex", gap:2 }}>
                    <StarRating rating={r.rating} size={11} />
                  </div>
                </div>
                {r.comment && <p style={{ fontSize:12, color:C.muted, marginLeft:34, lineHeight:1.5 }}>{r.comment}</p>}
              </div>
            ))}
          </Card>
        )}

        {selStore.hasStaff && selStore.staff?.filter(s=>s.isActive).length > 0 && (
          <Card>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <Users size={16} color={C.pri} />
              <h3 style={{ fontSize:14, fontWeight:900, color:C.text }}>
                {selStore.staff.filter(s=>s.isActive).length} {selStore.staff.filter(s=>s.isActive).length===1?"Staff Member":"Staff Members"} Available
              </h3>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {selStore.staff.filter(s=>s.isActive).map(s => (
                <div key={s._id} style={{ background:C.inputBg, border:"1.5px solid #E8ECF5", borderRadius:12, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:26, height:26, borderRadius:8, background:C.pri+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Users size={13} color={C.pri} />
                  </div>
                  <div>
                    <p style={{ fontSize:12, fontWeight:800, color:C.text }}>{s.name}</p>
                    {s.specialization && <p style={{ fontSize:10, color:C.muted }}>{s.specialization}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <Wrench size={16} color={C.pri} />
            <h3 style={{ fontSize:14, fontWeight:900, color:C.text }}>Services</h3>
          </div>
          {selStore.services?.map((s,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom:i<selStore.services.length-1?"1px solid #F0F2F8":"none" }}>
              <div>
                <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.name}</span>
                <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                  <Clock size={11} color={C.muted} />
                  <span style={{ fontSize:11, color:C.muted }}>{s.duration} min</span>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:1 }}>
                {s.isPriceVariable ? (
                  <span style={{ fontSize:11, fontWeight:800, color:"#92610A", background:C.acc+"22", padding:"3px 8px", borderRadius:8 }}>On Inspection</span>
                ) : (
                  <>
                    <IndianRupee size={13} color={C.pri} strokeWidth={2.5} />
                    <span style={{ fontSize:14, fontWeight:900, color:C.pri }}>{s.price}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <MessageSquare size={16} color={C.pri} />
            <h3 style={{ fontSize:14, fontWeight:900, color:C.text }}>Reviews</h3>
          </div>
          {selStore.reviews?.length > 0 ? selStore.reviews.slice(0,3).map((rev,i) => (
            <div key={i} style={{ paddingBottom:12, borderBottom:i<2 && i<selStore.reviews.length-1?"1px solid #F0F2F8":"none", marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:800, color:C.text }}>{rev.name}</span>
              <div style={{ display:"flex", gap:2, marginTop:4, marginBottom:4 }}>
                <StarRating rating={rev.rating} size={13} />
              </div>
              {rev.comment && <p style={{ fontSize:12, color:C.muted }}>{rev.comment}</p>}
            </div>
          )) : (
            <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"8px 0" }}>No reviews yet — be the first after your visit!</p>
          )}
        </Card>
      </div>
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:440, padding:"12px 20px 24px", background:C.card, boxShadow:"0 -4px 20px rgba(0,0,0,0.08)" }}>
        <Btn onClick={() => openBooking(selStore)} disabled={!selStore.isOpen}>
          {selStore.isOpen?"Book a Slot":"Store is Closed"}
        </Btn>
      </div>

      {/* Full-screen photo viewer — tap a thumbnail or the count badge to
          open. Supports both tap-arrow navigation AND swipe gestures
          (drag left = next photo, drag right = previous), matching the
          familiar swipeable-gallery pattern from apps like Instagram. */}
      {photoViewerIdx !== null && selStore.photos?.length > 0 && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:300, display:"flex", flexDirection:"column" }}
          onTouchStart={e => { swipeStartXRef.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (swipeStartXRef.current === null) return;
            const deltaX = e.changedTouches[0].clientX - swipeStartXRef.current;
            const SWIPE_THRESHOLD = 50; // pixels — ignores small accidental drags/taps
            if (deltaX < -SWIPE_THRESHOLD && photoViewerIdx < selStore.photos.length - 1) {
              setPhotoViewerIdx(i => i + 1); // swiped left → next photo
            } else if (deltaX > SWIPE_THRESHOLD && photoViewerIdx > 0) {
              setPhotoViewerIdx(i => i - 1); // swiped right → previous photo
            }
            swipeStartXRef.current = null;
          }}
        >
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"46px 16px 12px" }}>
            <span style={{ color:"#fff", fontSize:13, fontWeight:800 }}>{photoViewerIdx+1} / {selStore.photos.length}</span>
            <button onClick={() => setPhotoViewerIdx(null)} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:10, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <X size={18} color="#fff" />
            </button>
          </div>
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
            {photoViewerIdx > 0 && (
              <button onClick={() => setPhotoViewerIdx(i => i-1)} style={{ position:"absolute", left:8, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:2 }}>
                <ChevronLeft size={20} color="#fff" />
              </button>
            )}
            <img src={selStore.photos[photoViewerIdx]} alt="" draggable={false} style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", userSelect:"none" }} />
            {photoViewerIdx < selStore.photos.length-1 && (
              <button onClick={() => setPhotoViewerIdx(i => i+1)} style={{ position:"absolute", right:8, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:2 }}>
                <ChevronRight size={20} color="#fff" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ── Booking ───────────────────────────────────────────────────────────────
  if (screen==="booking" && selStore) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:110 }}>
      <TopBar title="Book a Slot" sub={selStore.name} onBack={() => setScreen("detail")} />
      <div style={{ padding:"16px" }}>
        <BookingStepper current={bookingStep} steps={bookingSteps} />
        <Card>
          <StepLabel n={1} label="Select Service(s)" />
          {selStore.services?.map((s,i) => {
            const isSelected = selServices.some(x => x.name === s.name);
            return (
              <div key={i} onClick={() => toggleService(s)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:13, borderRadius:13, marginBottom:8, cursor:"pointer", background:isSelected?C.pri+"15":C.inputBg, border:`2px solid ${isSelected?C.pri:"#E8ECF5"}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  {isSelected ? <CheckCircle size={20} color={C.pri} /> : <Circle size={20} color="#D0D4E0" />}
                  <div>
                    <span style={{ fontSize:14, fontWeight:800, color:C.text }}>{s.name}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                      <Clock size={11} color={C.muted} />
                      <span style={{ fontSize:11, color:C.muted }}>{s.duration} min</span>
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:1 }}>
                  {s.isPriceVariable ? (
                    <span style={{ fontSize:11, fontWeight:800, color:"#92610A", background:C.acc+"22", padding:"3px 8px", borderRadius:8 }}>On Inspection</span>
                  ) : (
                    <>
                      <IndianRupee size={13} color={C.pri} strokeWidth={2.5} />
                      <span style={{ fontSize:14, fontWeight:900, color:C.pri }}>{s.price}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {selServices.length > 1 && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10, paddingTop:12, borderTop:"1.5px dashed #E8ECF5" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <Clock size={13} color={C.text} />
                <span style={{ fontSize:13, fontWeight:800, color:C.text }}>{selServices.length} services · {totalServiceDuration} min total</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:1 }}>
                <IndianRupee size={14} color={C.pri} strokeWidth={2.5} />
                <span style={{ fontSize:16, fontWeight:900, color:C.pri }}>{totalServicePrice}</span>
              </div>
            </div>
          )}
        </Card>
        {needsStaff && (
          <Card>
            <StepLabel n={2} label="Select Doctor / Staff" />
            {staffSpecs.length > 2 && (
              <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:10, scrollbarWidth:"none" }}>
                {staffSpecs.map(spec => (
                  <button key={spec} onClick={() => setStaffSpecFilter(spec)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:"none", cursor:"pointer", background:staffSpecFilter===spec?C.pri:C.inputBg, color:staffSpecFilter===spec?"#fff":C.muted, fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>
                    {spec}
                  </button>
                ))}
              </div>
            )}
            {visibleStaff.length === 0 ? (
              <p style={{ color:C.muted, textAlign:"center", padding:"16px 0", fontSize:13 }}>No staff found for this specialization</p>
            ) : visibleStaff.map(s => (
              <div key={s._id} onClick={() => { setSelStaff(s); setSelSlot(null); }} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:13, borderRadius:13, marginBottom:8, cursor:"pointer", background:selStaff?._id===s._id?C.pri+"15":C.inputBg, border:`2px solid ${selStaff?._id===s._id?C.pri:"#E8ECF5"}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:38, height:38, borderRadius:12, background:C.pri+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Users size={17} color={C.pri} />
                  </div>
                  <div>
                    <span style={{ fontSize:14, fontWeight:800, color:C.text, display:"block" }}>{s.name}</span>
                    {s.specialization && <span style={{ fontSize:11, color:C.muted }}>{s.specialization}</span>}
                  </div>
                </div>
                {selStaff?._id===s._id && <CheckCircle size={18} color={C.green} />}
              </div>
            ))}
          </Card>
        )}
        <Card>
          <StepLabel n={needsStaff?3:2} label="Select Date" />
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
            {dates.map((d,i) => (
              <div key={i} onClick={() => {setSelDateIdx(i);setSelSlot(null);}} style={{ minWidth:54, textAlign:"center", padding:"11px 6px", borderRadius:14, cursor:"pointer", background:selDateIdx===i?`linear-gradient(135deg,${C.pri},#E0406A)`:C.inputBg, flexShrink:0 }}>
                <div style={{ fontSize:9, fontWeight:800, color:selDateIdx===i?"rgba(255,255,255,0.8)":C.muted }}>{i===0?"TODAY":DAY[getISTDay(d)]}</div>
                <div style={{ fontSize:20, fontWeight:900, color:selDateIdx===i?"#fff":C.text }}>{getISTDateNum(d)}</div>
                <div style={{ fontSize:9, color:selDateIdx===i?"rgba(255,255,255,0.7)":C.muted }}>{MON[getISTMonthIdx(d)]}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <StepLabel n={needsStaff?4:3} label="Select Time Slot" />
          {selServices.length===0 ? (
            <div style={{ textAlign:"center", padding:"20px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
              <Clock size={24} color={C.muted} />
              <p style={{ color:C.muted, fontSize:13 }}>Select at least one service first</p>
            </div>
          ) : needsStaff && !selStaff ? (
            <div style={{ textAlign:"center", padding:"20px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
              <Users size={24} color={C.muted} />
              <p style={{ color:C.muted, fontSize:13 }}>Select a doctor / staff member first</p>
            </div>
          ) : (
            <>
              {!dayClosure.isWholeDayClosed && (
                <p style={{ fontSize:12, color:C.muted, marginBottom:12, fontWeight:700 }}>
                  {slots.filter(s => s.available).length} slots available
                </p>
              )}
              <SlotPicker
                slots={slots}
                selected={selSlot}
                onSelect={setSelSlot}
                loading={slotsLoading}
                isWholeDayClosed={dayClosure.isWholeDayClosed}
                closureReason={dayClosure.closureReason}
              />
            </>
          )}
        </Card>
        {err && <div style={{ background:C.red+"15", borderRadius:12, padding:12, marginBottom:14, display:"flex", gap:8, alignItems:"center" }}><AlertCircle size={16} color={C.red} /><p style={{ color:C.red, fontSize:12, fontWeight:700 }}>{err}</p></div>}
      </div>
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:440, padding:"12px 20px 24px", background:C.card, boxShadow:"0 -4px 20px rgba(0,0,0,0.08)" }}>
        {selServices.length>0 && selSlot && (() => {
          // Offer discount is computed the same way the backend will —
          // this is a client-side preview only; the actual charge is
          // always recalculated and enforced server-side at booking time.
          const applicableOffer = selectedOffer && storeOffers.find(o => o._id === selectedOffer);
          let offerDiscountPreview = 0;
          if (applicableOffer && totalServicePrice >= (applicableOffer.minBookingValue||0)) {
            const namesMatch = applicableOffer.applicableServices?.length
              ? selServices.some(s => applicableOffer.applicableServices.includes(s.name))
              : true;
            if (namesMatch) {
              offerDiscountPreview = applicableOffer.discountType === "free"
                ? totalServicePrice
                : applicableOffer.discountType === "flat"
                  ? applicableOffer.discountValue
                  : Math.round(totalServicePrice * (applicableOffer.discountValue/100));
              if (applicableOffer.discountType==="percentage" && applicableOffer.maxDiscountAmount) {
                offerDiscountPreview = Math.min(offerDiscountPreview, applicableOffer.maxDiscountAmount);
              }
              offerDiscountPreview = Math.min(offerDiscountPreview, totalServicePrice);
            }
          }
          const priceAfterOffer = totalServicePrice - offerDiscountPreview;
          const walletDiscount = useWallet ? Math.min(walletBalance, priceAfterOffer) : 0;
          const finalPrice = priceAfterOffer - walletDiscount;
          return (
            <>
              {storeOffers.length > 0 && !hasVariablePriceSelected && (
                <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:8, paddingBottom:2, scrollbarWidth:"none" }}>
                  {storeOffers.map(o => (
                    <button key={o._id} onClick={() => setSelectedOffer(id => id===o._id ? null : o._id)} style={{ flexShrink:0, display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:20, border:`1.5px solid ${selectedOffer===o._id?C.pri:"#E8ECF5"}`, background:selectedOffer===o._id?C.pri+"12":"#fff", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                      <Tag size={11} color={o.discountType==="free"?C.green:selectedOffer===o._id?C.pri:C.muted} />
                      <span style={{ fontSize:11, fontWeight:800, color:o.discountType==="free"?C.green:selectedOffer===o._id?C.pri:C.muted }}>{o.discountType==="free"?"FREE":o.discountType==="percentage"?`${o.discountValue}% OFF`:`₹${o.discountValue} OFF`}</span>
                    </button>
                  ))}
                </div>
              )}
              {walletBalance > 0 && !hasVariablePriceSelected && (
                <div onClick={() => setUseWallet(w => !w)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, padding:"8px 12px", background:useWallet?C.green+"12":C.inputBg, borderRadius:10, cursor:"pointer", border:`1.5px solid ${useWallet?C.green+"44":"#E8ECF5"}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", background:useWallet?C.green:"#D0D4E0", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {useWallet && <CheckCircle size={12} color="#fff" fill="#fff" />}
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:useWallet?C.green:C.muted }}>Use ₹{walletBalance} wallet credit</span>
                  </div>
                  {useWallet && <span style={{ fontSize:12, fontWeight:900, color:C.green }}>-₹{walletDiscount}</span>}
                </div>
              )}
              {hasVariablePriceSelected && (
                <div style={{ background:C.acc+"15", borderRadius:10, padding:"10px 14px", marginBottom:10, display:"flex", gap:8, alignItems:"flex-start" }}>
                  <AlertCircle size={14} color="#92610A" style={{ flexShrink:0, marginTop:1 }} />
                  <p style={{ fontSize:11, color:"#92610A", fontWeight:700, lineHeight:1.4 }}>This booking includes a service priced after inspection — final cost will be confirmed at the store. Wallet credit, offers, and online payment aren't available for this booking.</p>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, padding:"0 4px" }}>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <Wrench size={13} color={C.muted} />
                  <span style={{ fontSize:13, color:C.muted, fontWeight:700 }}>{selServices.map(s=>s.name).join(" + ")}{selStaff?` · ${selStaff.name}`:""} · {selSlot}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  {(offerDiscountPreview>0 || walletDiscount>0) && <span style={{ fontSize:12, color:C.muted, textDecoration:"line-through" }}>₹{totalServicePrice}</span>}
                  <div style={{ display:"flex", alignItems:"center", gap:1 }}>
                    <IndianRupee size={13} color={C.pri} strokeWidth={2.5} />
                    <span style={{ fontSize:15, fontWeight:900, color:C.pri }}>{finalPrice}</span>
                  </div>
                </div>
              </div>
              {finalPrice > 0 && upiEnabled && !hasVariablePriceSelected && (
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  <button onClick={() => setPaymentMethod("cash")} style={{ flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${paymentMethod==="cash"?C.pri:"#E8ECF5"}`, background:paymentMethod==="cash"?C.pri+"10":"#fff", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                    <p style={{ fontSize:12, fontWeight:800, color:paymentMethod==="cash"?C.pri:C.muted }}>Pay at Store</p>
                  </button>
                  <button onClick={() => setPaymentMethod("upi")} style={{ flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${paymentMethod==="upi"?C.pri:"#E8ECF5"}`, background:paymentMethod==="upi"?C.pri+"10":"#fff", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                    <p style={{ fontSize:12, fontWeight:800, color:paymentMethod==="upi"?C.pri:C.muted }}>Pay Online (UPI)</p>
                  </button>
                </div>
              )}
            </>
          );
        })()}
        <Btn onClick={book} disabled={!(selServices.length>0&&selSlot)||(needsStaff&&!selStaff)||loading}>
          {loading?"Booking...":(needsStaff&&!selStaff)?"Select a doctor / staff":(selServices.length>0&&selSlot)?"Confirm Booking":"Select service & time slot"}
        </Btn>
      </div>
    </div>
  );

  // ── Confirmed ─────────────────────────────────────────────────────────────
  if (screen==="confirmed" && confirmed) return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg,${C.sec},#2D1B4E)`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'Nunito',sans-serif", textAlign:"center" }}>
      <div style={{ position:"relative", width:110, height:110, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
        <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:`3px solid ${C.green}`, animation:"successRing 1.4s ease-out 0.3s infinite" }} />
        <div style={{ width:96, height:96, borderRadius:"50%", background:`linear-gradient(135deg, ${C.green}, #00A887)`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 8px 28px ${C.green}66`, animation:"successPop 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <CheckCircle size={58} color="#fff" strokeWidth={2.5} />
        </div>
      </div>
      <h2 style={{ fontSize:28, fontWeight:900, color:"#fff", marginBottom:6 }}>Slot Confirmed!</h2>
      <p style={{ fontSize:14, color:"rgba(255,255,255,0.6)", marginBottom:confirmed.staffName?6:28 }}>No more standing in queues!</p>
      {confirmed.staffName && (
        <p style={{ fontSize:13, color:C.acc, fontWeight:800, marginBottom:confirmed.serviceBreakdown?.length>1?12:22 }}>with {confirmed.staffName}</p>
      )}
      {confirmed.serviceBreakdown?.length > 1 && (
        <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:14, padding:"10px 16px", marginBottom:20, width:"100%" }}>
          {confirmed.serviceBreakdown.map((s,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>{s.name}</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>₹{s.price}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ background:`linear-gradient(135deg,${C.pri},#E0406A)`, borderRadius:24, padding:"20px 50px", marginBottom:20, boxShadow:`0 8px 32px ${C.pri}44`, width:"100%" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:6 }}>
          <Ticket size={14} color="rgba(255,255,255,0.7)" />
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:10, letterSpacing:3 }}>YOUR TOKEN</p>
        </div>
        <p style={{ color:"#fff", fontSize:60, fontWeight:900, lineHeight:1 }}>{confirmed.tokenNumber}</p>
      </div>
      <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:20, padding:"16px 40px", marginBottom:20, border:"2px solid rgba(255,255,255,0.2)", width:"100%" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:8 }}>
          <Shield size={14} color="rgba(255,255,255,0.7)" />
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:10, letterSpacing:3 }}>YOUR OTP</p>
        </div>
        <p style={{ color:"#fff", fontSize:48, fontWeight:900, lineHeight:1, letterSpacing:8 }}>{confirmed.otp}</p>
        <p style={{ color:"rgba(255,255,255,0.5)", fontSize:11, marginTop:8 }}>Show this to the shop owner to start service</p>
      </div>
      <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:14, padding:"12px 20px", marginBottom:20, display:"flex", gap:8, alignItems:"center", width:"100%", boxSizing:"border-box" }}>
        <Clock size={14} color="rgba(255,255,255,0.7)" style={{ flexShrink:0 }} />
        <p style={{ color:"rgba(255,255,255,0.8)", fontSize:12, fontWeight:700 }}>Please arrive at least 15 minutes before your slot time</p>
      </div>
      {confirmed.walletDeducted > 0 && (
        <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:12, padding:"10px 16px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%" }}>
          <span style={{ color:"rgba(255,255,255,0.85)", fontSize:13, fontWeight:700 }}>💰 Wallet credit applied</span>
          <span style={{ color:"#fff", fontSize:14, fontWeight:900 }}>-₹{confirmed.walletDeducted}</span>
        </div>
      )}
      <a href={getDirectionsUrl(confirmed.store)} target="_blank" rel="noreferrer" style={{ width:"100%", textDecoration:"none", marginBottom:12 }}>
        <div style={{ width:"100%", padding:"14px", background:"rgba(255,255,255,0.1)", border:"2px solid rgba(255,255,255,0.2)", borderRadius:14, color:"#fff", fontWeight:800, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Navigation size={16} /> Get Directions
        </div>
      </a>
      <Btn onClick={() => {setScreen("home");setTab("home");setConfirmed(null);setSelServices([]);setSelStaff(null);setSelSlot(null);}}>Back to Home</Btn>
    </div>
  );

  // ── My Bookings ───────────────────────────────────────────────────────────
  if (tab==="bookings") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:100 }}>
      {ToastEl}
      {ReviewSheet}
      {CancelSheet}
      {RescheduleSheet}
      <TopBar title="My Bookings" sub={`${myBookings.length} bookings`} onBack={() => setTab("home")} />
      <div style={{ padding:16 }}>
        {myBookings.length===0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ width:72, height:72, borderRadius:24, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <ClipboardList size={32} color={C.pri} />
            </div>
            <p style={{ fontSize:16, fontWeight:800, color:C.text }}>No bookings yet</p>
            <p style={{ fontSize:13, color:C.muted, marginTop:8 }}>Book your first slot now</p>
            <button onClick={() => {setTab("home");setScreen("stores");fetchStores();}} style={{ marginTop:20, padding:"12px 28px", background:`linear-gradient(135deg,${C.pri},#E0406A)`, color:"#fff", border:"none", borderRadius:14, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Find a Store</button>
          </div>
        ) : myBookings.map(b => (
          <Card key={b._id}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <h3 style={{ fontSize:15, fontWeight:900, color:C.text }}>{b.store?.name||"Store"}</h3>
              <Badge color={b.status==="confirmed"?C.blue:b.status==="completed"?C.green:C.red} text={b.status} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}><Wrench size={12} color={C.muted} /><span style={{ fontSize:12, color:C.muted }}>{b.service?.name}</span></div>
              {b.staffName && (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}><Users size={12} color={C.muted} /><span style={{ fontSize:12, color:C.muted }}>{b.staffName}</span></div>
              )}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}><Calendar size={12} color={C.muted} /><span style={{ fontSize:12, color:C.muted }}>{b.date}</span><Clock size={12} color={C.muted} style={{ marginLeft:8 }} /><span style={{ fontSize:12, color:C.muted }}>{b.timeSlot}</span></div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}><MapPin size={12} color={C.muted} /><span style={{ fontSize:12, color:C.muted }}>{b.store?.city}</span></div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:11, paddingTop:11, borderTop:"1px solid #F0F2F8" }}>
              <div style={{ background:C.sec, borderRadius:10, padding:"6px 14px", display:"flex", alignItems:"center", gap:6 }}>
                <Ticket size={14} color="#fff" />
                <span style={{ color:"#fff", fontWeight:900, fontSize:15 }}>{b.tokenNumber}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {b.paymentMode === "upi" && (
                  <span style={{ fontSize:10, fontWeight:800, color:b.paymentStatus==="paid"?C.green:C.acc, background:b.paymentStatus==="paid"?C.green+"12":C.acc+"15", padding:"3px 8px", borderRadius:8 }}>
                    {b.paymentStatus==="paid" ? "Paid via UPI ✓" : "Payment Pending"}
                  </span>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:1 }}>
                  <IndianRupee size={13} color={C.pri} strokeWidth={2.5} />
                  <span style={{ fontSize:14, fontWeight:900, color:C.pri }}>{b.service?.price}</span>
                </div>
              </div>
            </div>
            {b.status==="confirmed" && (
              <div style={{ display:"flex", gap:6, marginTop:10 }}>
                <a href={getDirectionsUrl(b.store)} target="_blank" rel="noreferrer" style={{ flex:1, textDecoration:"none" }}>
                  <div style={{ padding:"10px 4px", background:C.blue+"12", color:C.blue, border:`1.5px solid ${C.blue}33`, borderRadius:10, fontWeight:800, fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                    <Navigation size={12} /> Directions
                  </div>
                </a>
                <button
                  onClick={() => openRescheduleModal(b)}
                  style={{ flex:1, padding:"10px 4px", background:C.acc+"18", color:"#B8860B", border:`1.5px solid ${C.acc}55`, borderRadius:10, fontWeight:800, fontSize:11, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}
                >
                  Change Slot
                </button>
                <button
                  onClick={() => openCancelModal(b)}
                  style={{ flex:1, padding:"10px 4px", background:C.red+"12", color:C.red, border:`1.5px solid ${C.red}33`, borderRadius:10, fontWeight:800, fontSize:11, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}
                >
                  Cancel
                </button>
              </div>
            )}
            {b.status==="confirmed" && b.date===getISTDateString() && queueAhead[b._id] !== undefined && (
              <div style={{ background:C.blue+"12", borderRadius:10, padding:"10px 14px", marginTop:10, display:"flex", alignItems:"center", gap:8, border:`1px solid ${C.blue}22` }}>
                <Users size={14} color={C.blue} />
                <span style={{ fontSize:12, color:C.blue, fontWeight:800 }}>
                  {queueAhead[b._id]===0 ? "You're next in line!" : `${queueAhead[b._id]} ${queueAhead[b._id]===1?"person":"people"} ahead of you`}
                </span>
              </div>
            )}
            {b.otp && b.status==="confirmed" && (
              <div style={{ background:C.pri+"12", borderRadius:10, padding:"10px 14px", marginTop:10, display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${C.pri}22` }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <Lock size={14} color={C.pri} />
                  <span style={{ fontSize:12, color:C.muted, fontWeight:700 }}>Your OTP</span>
                </div>
                <span style={{ fontSize:24, fontWeight:900, color:C.pri, letterSpacing:6 }}>{b.otp}</span>
              </div>
            )}
            {b.status==="in_progress" && b.otpVerified && (
              <div style={{ background:C.green+"15", borderRadius:10, padding:"8px 14px", marginTop:10, display:"flex", alignItems:"center", gap:8 }}>
                <CheckCircle size={16} color={C.green} />
                <span style={{ fontSize:12, color:C.green, fontWeight:800 }}>OTP Verified — Service in progress</span>
              </div>
            )}
            {(b.status==="completed" || b.status==="cancelled") && (
              <button
                onClick={() => bookAgain(b)}
                disabled={bookAgainId===b._id}
                style={{ width:"100%", marginTop:10, padding:"11px", background:bookAgainId===b._id?"#E0E4EF":`linear-gradient(135deg,${C.pri},#C0304A)`, color:bookAgainId===b._id?"#AAB":"#fff", border:"none", borderRadius:10, fontWeight:800, fontSize:13, cursor:bookAgainId===b._id?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}
              >
                <RotateCcw size={14} /> {bookAgainId===b._id?"Loading...":"Book Again"}
              </button>
            )}
            {b.status==="completed" && (
              reviewedStores.has(b.store?._id) ? (
                <div style={{ background:C.acc+"15", borderRadius:10, padding:"10px 14px", marginTop:10, display:"flex", alignItems:"center", gap:8 }}>
                  <Star size={15} color={C.acc} fill={C.acc} />
                  <span style={{ fontSize:12, color:"#B8860B", fontWeight:800 }}>You rated this store — thanks!</span>
                </div>
              ) : (
                <button
                  onClick={() => openReview(b)}
                  style={{ width:"100%", marginTop:10, padding:"11px", background:`linear-gradient(135deg,${C.acc},#FFB800)`, color:"#1A1A2E", border:"none", borderRadius:10, fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}
                >
                  <Star size={15} color="#1A1A2E" /> Rate your experience
                </button>
              )
            )}
          </Card>
        ))}
      </div>
      <BottomNav tabs={BOTTOM_TABS} active={tab} onChange={onNavChange} />
    </div>
  );

  // ── Profile ───────────────────────────────────────────────────────────────
  if (tab==="profile") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:80 }}>
      <div style={{ background:`linear-gradient(135deg,${C.pri},#E0406A)`, padding:"44px 20px 32px", borderBottomLeftRadius:32, borderBottomRightRadius:32 }}>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, color:"#fff", fontWeight:900 }}>{user.name?.charAt(0)}</div>
          <div>
            <h2 style={{ fontSize:20, fontWeight:900, color:"#fff" }}>{user.name}</h2>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>{user.email}</p>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
              <Phone size={12} color="rgba(255,255,255,0.7)" />
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>{user.phone}</p>
            </div>
            <button onClick={() => setShowLocPicker(true)} style={{ fontSize:12, color:"rgba(255,255,255,0.9)", background:"rgba(255,255,255,0.15)", border:"none", borderRadius:20, padding:"3px 12px", cursor:"pointer", marginTop:6, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:5 }}>
              <MapPin size={11} color="rgba(255,255,255,0.9)" />
              {userArea&&`${userArea}, `}{userCity||"Set Location"}
              <ChevronDown size={11} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding:16 }}>
        {/* No-show restriction warning — shown prominently if active */}
        {user.bookingRestrictedUntil && new Date() < new Date(user.bookingRestrictedUntil) && (
          <div style={{ background:C.red+"12", border:`1.5px solid ${C.red}33`, borderRadius:16, padding:"14px 16px", marginBottom:16, display:"flex", gap:10, alignItems:"flex-start" }}>
            <AlertCircle size={18} color={C.red} style={{ flexShrink:0, marginTop:1 }} />
            <div>
              <p style={{ fontSize:13, fontWeight:900, color:C.red, marginBottom:2 }}>Booking access restricted</p>
              <p style={{ fontSize:11, color:C.muted }}>Due to {user.noShowCount} no-shows, booking is restricted until {new Date(user.bookingRestrictedUntil).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}. Always cancel in advance if you can't make it.</p>
            </div>
          </div>
        )}
        {/* No-show warning — show if approaching threshold but not yet restricted */}
        {user.noShowCount >= 3 && !user.bookingRestrictedUntil && (
          <div style={{ background:C.acc+"18", border:`1.5px solid ${C.acc}44`, borderRadius:16, padding:"12px 16px", marginBottom:16, display:"flex", gap:10, alignItems:"center" }}>
            <AlertCircle size={16} color={C.acc} />
            <p style={{ fontSize:12, fontWeight:700, color:"#92610A" }}>⚠️ {user.noShowCount} no-shows recorded. At 5, booking will be restricted for 7 days.</p>
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          {[
            [ClipboardList, myBookings.length,                                                                        "Bookings",   C.blue],
            [CheckCircle,   myBookings.filter(b=>b.status==="completed").length,                                      "Completed",  C.green],
            [Wallet,        walletBalance,                                                                            "Wallet",     C.pri],
          ].map(([Icon,v,l,col]) => (
            <div key={l} style={{ flex:1, background:C.card, borderRadius:16, padding:"14px 8px", textAlign:"center", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:4 }}><Icon size={20} color={col} /></div>
              <div style={{ fontSize:17, fontWeight:900, color:C.text }}>{l==="Wallet"?`₹${v}`:v}</div>
              <div style={{ fontSize:10, color:C.muted }}>{l}</div>
            </div>
          ))}
        </div>
        {[
          [ClipboardList, "My Bookings",     "bookings", null],
          [Heart,         "My Favorites",    null,       () => setScreen("favorites")],
          [Gift,          "Refer & Earn 🎁", null,       () => setShowReferral(true)],
          [Bell,          "Enable Notifications", null,  async () => { const r = await enablePushNotifications(); showToast(r.message, r.success?"success":"error"); }],
          [MapPin,        "Change Location", null,       () => setShowLocPicker(true)],
          [Settings,      "Settings",        null,       () => setShowSettings(true)],
          [HelpCircle,    "Help & Support",  null,       () => { fetchMyTickets(); setScreen("help"); }],
        ].filter(([,label]) => referralEnabled || label !== "Refer & Earn 🎁").map(([Icon, label, navTab, action]) => (
          <div key={label} onClick={() => navTab?setTab(navTab):action&&action()} style={{ background:C.card, borderRadius:16, padding:"14px 16px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:12, background:C.pri+"12", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon size={16} color={C.pri} />
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{label}</span>
            </div>
            <ChevronRight size={16} color={C.muted} />
          </div>
        ))}
        <div onClick={logout} style={{ background:"#FFF0F0", borderRadius:16, padding:"14px 16px", marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:12, background:C.red+"20", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <LogOut size={16} color={C.red} />
            </div>
            <span style={{ fontSize:14, fontWeight:700, color:C.red }}>Logout</span>
          </div>
          <ChevronRight size={16} color={C.red} />
        </div>
      </div>
      <BottomNav tabs={BOTTOM_TABS} active={tab} onChange={onNavChange} />

      {/* Referral screen — rendered inside the Profile tab's own return
          block so it survives switching between Home/Explore/Bookings/
          Profile tabs (each of those is a separate conditional return,
          so state defined only inside one screen resets if placed in
          the wrong one — this placement was the actual fix that made
          it durable, same lesson learned from the chat feature). */}
      {showReferral && (
        <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", justifyContent:"center" }}>
          <div style={{ width:"100%", maxWidth:440, background:C.bg, overflowY:"auto", fontFamily:"'Nunito',sans-serif" }}>
            <div style={{ background:`linear-gradient(100deg,${C.pri},#DB2777)`, padding:"52px 20px 24px" }}>
              <button onClick={() => setShowReferral(false)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:12, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", marginBottom:12 }}>
                <ArrowLeft size={18} color="#fff" />
              </button>
              <h1 style={{ fontSize:22, fontWeight:900, color:"#fff" }}>Refer & Earn</h1>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.75)", marginTop:4 }}>Invite friends, earn ₹50 each</p>
            </div>
            <div style={{ padding:"16px" }}>
              <ReferralScreen />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return null;
}