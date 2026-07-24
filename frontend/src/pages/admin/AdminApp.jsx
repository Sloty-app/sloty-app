import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import { C, CATS, getCat } from "../../constants";
import { Loader, StarRating } from "../../components/UI";
import {
  LayoutDashboard, Clock, Store, Map, LogOut,
  CheckCircle, XCircle, Users, MapPin, Star,
  ClipboardList, TrendingUp, User, Circle, AlertCircle,
  MessageCircle, FileText, X, ChevronLeft, ChevronRight, Image as ImageIcon,
  IndianRupee, Phone, CalendarDays, ArrowLeft, Search, Wallet, Ban, Gift
} from "lucide-react";

const StatCard = ({ icon: Icon, value, label, color, onClick }) => (
  <div onClick={onClick} style={{ background:"rgba(255,255,255,0.06)", borderRadius:18, padding:16, borderLeft:`4px solid ${color}`, cursor:onClick?"pointer":"default", transition:"background 0.15s" }}>
    <div style={{ width:36, height:36, borderRadius:12, background:color+"22", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}>
      <Icon size={18} color={color} />
    </div>
    <div style={{ fontSize:20, fontWeight:900, color }}>{value}</div>
    <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{label}</div>
  </div>
);

/* ── Store Detail Modal — full analytics view for admin to examine one store ── */
function StoreDetailModal({ storeId, onClose, onRemoved }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");
  const [showConfirm, setShowConfirm] = useState(false); // confirm dialog before removing
  const [acting,  setActing]  = useState(false); // remove/restore request in flight

  const fetchDetail = () => {
    setLoading(true); setErr("");
    api("GET", `/stores/admin/${storeId}/analytics`)
      .then(res => setData(res))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!storeId) return;
    fetchDetail();
  }, [storeId]);

  const handleRemove = async () => {
    setActing(true);
    try {
      await api("PUT", `/stores/admin/${storeId}/remove`, {});
      setShowConfirm(false);
      onRemoved?.();
    } catch (e) { setErr(e.message); }
    finally { setActing(false); }
  };

  const handleRestore = async () => {
    setActing(true);
    try {
      await api("PUT", `/stores/admin/${storeId}/restore`, {});
      fetchDetail(); // refresh in place so the "removed" banner clears
    } catch (e) { setErr(e.message); }
    finally { setActing(false); }
  };

  if (!storeId) return null;

  return (
    <div style={{ position:"fixed", inset:0, background:"#0F0F1A", zIndex:250, overflowY:"auto" }}>
      <div style={{ width:"100%", maxWidth:440, margin:"0 auto", minHeight:"100vh", background:"#0F0F1A" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:10, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <ArrowLeft size={18} color="#fff" />
        </button>
        <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>Store Details</h3>
      </div>

      <div style={{ padding:16 }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <Loader text="Loading store details..." />
          </div>
        ) : err ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <AlertCircle size={32} color={C.red} style={{ marginBottom:10 }} />
            <p style={{ color:"rgba(255,255,255,0.5)" }}>{err}</p>
          </div>
        ) : data && (() => {
          const { store, stats, recentBookings } = data;
          const cat = getCat(store.category);
          const CatIcon = cat.Icon;
          return (
            <>
              {/* Store header */}
              <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:20 }}>
                <div style={{ width:56, height:56, borderRadius:16, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <CatIcon size={26} color={cat.color} strokeWidth={1.6} />
                </div>
                <div style={{ flex:1 }}>
                  <h2 style={{ fontSize:19, fontWeight:900, color:"#fff" }}>{store.name}</h2>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                    <span style={{ fontSize:11, background:cat.color+"22", color:cat.color, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{cat.name}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:5, background:store.isApproved?C.green+"22":C.acc+"22", padding:"3px 10px", borderRadius:20 }}>
                      <Circle size={6} color={store.isApproved?C.green:C.acc} fill={store.isApproved?C.green:C.acc} />
                      <span style={{ fontSize:10, color:store.isApproved?C.green:C.acc, fontWeight:700 }}>{store.isApproved?"Live":"Pending"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Removed-status banner + remove/restore action */}
              {store.isActive === false ? (
                <div style={{ background:C.red+"15", border:`1.5px solid ${C.red}44`, borderRadius:14, padding:"12px 14px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <AlertCircle size={15} color={C.red} />
                    <span style={{ fontSize:12, fontWeight:700, color:C.red }}>Removed — hidden from customers</span>
                  </div>
                  <button onClick={handleRestore} disabled={acting} style={{ padding:"6px 14px", background:C.green, border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:11, cursor:acting?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif" }}>
                    {acting?"...":"Restore"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowConfirm(true)} style={{ width:"100%", padding:"12px", background:C.red+"12", color:C.red, border:`1.5px solid ${C.red}33`, borderRadius:12, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontSize:13, marginBottom:16, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <XCircle size={15} /> Remove Store
                </button>
              )}

              {/* Contact & location */}
              <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:16, padding:14, marginBottom:16, border:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <User size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{store.owner?.name} · {store.owner?.email}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <Phone size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{store.phone}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <MapPin size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{store.area && `${store.area}, `}{store.city}</span>
                </div>
              </div>

              {/* Photos */}
              {store.photos?.length > 0 && (
                <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:16, scrollbarWidth:"none" }}>
                  {store.photos.map((p,i) => (
                    <img key={i} src={p} alt="" loading="lazy" style={{ width:90, height:90, borderRadius:12, objectFit:"cover", flexShrink:0 }} />
                  ))}
                </div>
              )}

              {/* Key analytics */}
              <h4 style={{ fontSize:13, fontWeight:900, color:"rgba(255,255,255,0.5)", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>Performance</h4>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
                <StatCard icon={IndianRupee}    value={`₹${stats.totalRevenue}`}   label="Total Revenue"       color={C.green} />
                <StatCard icon={TrendingUp}     value={`₹${stats.recentRevenue}`}  label="Revenue (30 days)"   color={C.blue}  />
                <StatCard icon={ClipboardList}  value={stats.totalBookings}        label="Total Bookings"      color={C.pri}   />
                <StatCard icon={CheckCircle}    value={stats.completed}            label="Completed"           color={C.green} />
                <StatCard icon={XCircle}        value={stats.cancelled}            label="Cancelled"           color={C.red}   />
                <StatCard icon={AlertCircle}    value={stats.noShow}               label="No-Shows"            color={C.acc}   />
                <StatCard icon={Star}           value={store.rating || "—"}        label={`Rating (${store.totalReviews||0} reviews)`} color={C.acc} />
                <StatCard icon={IndianRupee}    value={`₹${stats.avgBookingValue}`} label="Avg. Booking Value"  color={C.blue}  />
              </div>

              {/* Recent bookings */}
              <h4 style={{ fontSize:13, fontWeight:900, color:"rgba(255,255,255,0.5)", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>Recent Bookings</h4>
              {recentBookings.length === 0 ? (
                <p style={{ color:"rgba(255,255,255,0.35)", fontSize:12, textAlign:"center", padding:"20px 0" }}>No bookings yet</p>
              ) : recentBookings.map(b => (
                <div key={b._id} style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"10px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <p style={{ fontSize:12, fontWeight:800, color:"#fff" }}>{b.customerName}</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{b.service} · {b.date} · {b.timeSlot}</p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:13, fontWeight:900, color:C.pri }}>₹{b.price}</p>
                    <span style={{ fontSize:9, color: b.status==="completed"?C.green : b.status==="cancelled"||b.status==="no_show"?C.red : C.acc, fontWeight:700, textTransform:"uppercase" }}>{b.status.replace("_"," ")}</span>
                  </div>
                </div>
              ))}
            </>
          );
        })()}
      </div>
      </div>

      {/* Confirmation dialog — removing a store hides it from every
          customer immediately, so this needs a deliberate confirm step
          rather than a single accidental tap. */}
      {showConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#1A1A2E", borderRadius:20, padding:22, width:"100%", maxWidth:340, border:"1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ width:44, height:44, borderRadius:14, background:C.red+"22", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
              <XCircle size={22} color={C.red} />
            </div>
            <h3 style={{ fontSize:16, fontWeight:900, color:"#fff", marginBottom:8 }}>Remove this store?</h3>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.55)", marginBottom:18, lineHeight:1.5 }}>
              This store will immediately disappear from customer search, browsing, and the AI assistant. Booking history and reviews are kept — you can restore it anytime.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowConfirm(false)} disabled={acting} style={{ flex:1, padding:"11px", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleRemove} disabled={acting} style={{ flex:1, padding:"11px", background:C.red, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:13, cursor:acting?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif" }}>
                {acting?"Removing...":"Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Customer Detail Modal — full booking history for one customer ── */
function CustomerDetailModal({ customerId, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    if (!customerId) return;
    setLoading(true); setErr("");
    api("GET", `/analytics/admin/customers/${customerId}`)
      .then(res => setData(res))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (!customerId) return null;

  return (
    <div style={{ position:"fixed", inset:0, background:"#0F0F1A", zIndex:250, overflowY:"auto" }}>
      <div style={{ width:"100%", maxWidth:440, margin:"0 auto", minHeight:"100vh", background:"#0F0F1A" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:10, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <ArrowLeft size={18} color="#fff" />
        </button>
        <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>Customer Details</h3>
      </div>

      <div style={{ padding:16 }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <Loader text="Loading customer details..." />
          </div>
        ) : err ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <AlertCircle size={32} color={C.red} style={{ marginBottom:10 }} />
            <p style={{ color:"rgba(255,255,255,0.5)" }}>{err}</p>
          </div>
        ) : data && (() => {
          const { customer, stats, bookings } = data;
          return (
            <>
              {/* Customer header */}
              <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:20 }}>
                <div style={{ width:56, height:56, borderRadius:16, background:C.pri+"22", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:22, fontWeight:900, color:C.pri }}>{customer.name?.[0]?.toUpperCase()||"?"}</span>
                </div>
                <div style={{ flex:1 }}>
                  <h2 style={{ fontSize:19, fontWeight:900, color:"#fff" }}>{customer.name}</h2>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                    {customer.isActive === false && (
                      <span style={{ fontSize:10, background:C.red+"22", color:C.red, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>Deactivated</span>
                    )}
                    {customer.bookingRestrictedUntil && new Date(customer.bookingRestrictedUntil) > new Date() && (
                      <span style={{ fontSize:10, background:C.acc+"22", color:C.acc, padding:"3px 10px", borderRadius:20, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
                        <Ban size={10} /> Booking restricted
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact & location */}
              <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:16, padding:14, marginBottom:16, border:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <Phone size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{customer.phone || "No phone"}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <User size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{customer.email}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <MapPin size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>{customer.area && `${customer.area}, `}{customer.city || "No city set"}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <CalendarDays size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>Joined {new Date(customer.joinedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
                </div>
              </div>

              {/* Key stats */}
              <h4 style={{ fontSize:13, fontWeight:900, color:"rgba(255,255,255,0.5)", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>Booking Activity</h4>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
                <StatCard icon={ClipboardList} value={stats.totalBookings}       label="Total Bookings"     color={C.pri}   />
                <StatCard icon={CheckCircle}   value={stats.completed}           label="Completed"          color={C.green} />
                <StatCard icon={XCircle}       value={stats.cancelled}           label="Cancelled"          color={C.red}   />
                <StatCard icon={AlertCircle}   value={stats.noShow}              label="No-Shows"           color={C.acc}   />
                <StatCard icon={IndianRupee}   value={`₹${stats.totalSpent}`}    label="Total Spent"        color={C.green} />
                <StatCard icon={IndianRupee}   value={`₹${stats.avgBookingValue}`} label="Avg. Booking Value" color={C.blue} />
                <StatCard icon={Wallet}        value={`₹${customer.walletBalance||0}`} label="Wallet Balance" color={C.blue} />
                <StatCard icon={Users}         value={customer.referralCount||0} label="Friends Referred"   color={C.pri}   />
              </div>

              {stats.favoriteStore && (
                <div style={{ background:C.pri+"12", border:`1px solid ${C.pri}33`, borderRadius:14, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                  <Star size={16} color={C.pri} />
                  <div>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>Most-visited store</p>
                    <p style={{ fontSize:13, fontWeight:800, color:"#fff" }}>{stats.favoriteStore.name} · {stats.favoriteStore.count} visit{stats.favoriteStore.count!==1?"s":""}</p>
                  </div>
                </div>
              )}

              {/* Booking history */}
              <h4 style={{ fontSize:13, fontWeight:900, color:"rgba(255,255,255,0.5)", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>Booking History</h4>
              {bookings.length === 0 ? (
                <p style={{ color:"rgba(255,255,255,0.35)", fontSize:12, textAlign:"center", padding:"20px 0" }}>No bookings yet</p>
              ) : bookings.map(b => (
                <div key={b._id} style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"10px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <p style={{ fontSize:12, fontWeight:800, color:"#fff" }}>{b.storeName}</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{b.service} · {b.date} · {b.timeSlot}</p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:13, fontWeight:900, color:C.pri }}>₹{b.price}</p>
                    <span style={{ fontSize:9, color: b.status==="completed"?C.green : b.status==="cancelled"||b.status==="no_show"?C.red : C.acc, fontWeight:700, textTransform:"uppercase" }}>{b.status.replace("_"," ")}</span>
                  </div>
                </div>
              ))}
            </>
          );
        })()}
      </div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const { user, logout } = useAuth();
  // Restores the tab after a browser-triggered reload — see the
  // matching comment in CustomerApp.jsx for the full reasoning.
  const [tab,       setTab]       = useState(() => sessionStorage.getItem("sloty-admin-tab") || "overview");
  const [pending,   setPending]   = useState([]);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [settlementNote, setSettlementNote] = useState({}); // { [settlementId]: noteText }
  const [completingSettlement, setCompletingSettlement] = useState(null); // settlement id currently being marked complete
  const [photoViewer, setPhotoViewer] = useState(null); // { photos, idx } or null
  const [storesFilter, setStoresFilter] = useState("all"); // "all" | "approved"
  const [selectedStoreId, setSelectedStoreId] = useState(null); // for the Store Detail modal
  const [selectedCustomerId, setSelectedCustomerId] = useState(null); // for the Customer Detail modal
  const [catDetail, setCatDetail] = useState(null); // category id currently drilled into, from Overview
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [referralToggling, setReferralToggling] = useState(false);
  const [upiEnabled, setUpiEnabled] = useState(false);
  const [upiToggling, setUpiToggling] = useState(false);

  // Syncs the active tab, the Store Detail modal, and the photo viewer
  // with real browser history, so Android's native back gesture and the
  // on-screen/hardware back button both correctly step backward —
  // closing whichever overlay is open first (photo viewer, then Store
  // Detail), then navigating tabs.
  const isPoppingRef = useRef(false);
  const anyOverlayOpen = !!selectedStoreId || !!photoViewer || !!selectedCustomerId || !!catDetail;
  useEffect(() => {
    if (isPoppingRef.current) { isPoppingRef.current = false; return; }
    window.history.pushState({ tab, overlayOpen: anyOverlayOpen }, "");
  }, [tab, selectedStoreId, photoViewer, selectedCustomerId, catDetail]);
  useEffect(() => {
    const onPopState = (e) => {
      isPoppingRef.current = true;
      if (!e.state?.overlayOpen) {
        setPhotoViewer(null);
        setSelectedStoreId(null);
        setSelectedCustomerId(null);
        setCatDetail(null);
      }
      if (e.state?.tab) setTab(e.state.tab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [allStores, setAllStores] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tickets,      setTickets]      = useState([]);
  const [ticketFilter, setTicketFilter] = useState("open");
  const [customersData,    setCustomersData]    = useState(null); // { totals, customers }
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch,   setCustomerSearch]   = useState("");
  const [customerSort,     setCustomerSort]     = useState("bookings"); // "bookings" | "spent" | "recent"

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        api("GET", "/stores/admin/pending"),
        api("GET", "/stores/admin/all"),
      ]);
      setPending(pRes.stores||[]);
      setAllStores(aRes.stores||[]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchTickets = async (status) => {
    try {
      const q = status ? `?status=${status}` : "";
      const res = await api("GET", `/support/admin/all${q}`);
      setTickets(res.tickets||[]);
    } catch(e) { console.error(e); }
  };

  const updateTicket = async (id, status) => {
    try { await api("PUT", `/support/${id}/status`, { status }); fetchTickets(ticketFilter==="all"?null:ticketFilter); }
    catch(e) { console.error(e); }
  };

  const fetchPendingSettlements = async () => {
    try {
      const res = await api("GET", "/settlements/pending");
      setPendingSettlements(res.settlements || []);
    } catch(e) { console.error(e); }
  };

  const completeSettlement = async (id) => {
    setCompletingSettlement(id);
    try {
      await api("PUT", `/settlements/${id}/complete`, { note: settlementNote[id] || "" });
      fetchPendingSettlements();
    } catch(e) { console.error(e); }
    finally { setCompletingSettlement(null); }
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    try {
      const res = await api("GET", `/analytics/admin/customers?limit=200&sort=${customerSort}`);
      setCustomersData(res);
    } catch(e) { console.error(e); }
    finally { setCustomersLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    api("GET", "/settings/public").then(res => { setReferralEnabled(res.referralProgramEnabled); setUpiEnabled(res.upiPaymentsEnabled); }).catch(()=>{});
  }, []);

  const toggleReferralProgram = async () => {
    setReferralToggling(true);
    try {
      const next = !referralEnabled;
      await api("PUT", "/settings/referral-program", { enabled: next });
      setReferralEnabled(next);
    } catch (e) { console.error(e); }
    finally { setReferralToggling(false); }
  };

  const toggleUpiPayments = async () => {
    setUpiToggling(true);
    try {
      const next = !upiEnabled;
      await api("PUT", "/settings/upi-payments", { enabled: next });
      setUpiEnabled(next);
    } catch (e) { console.error(e); }
    finally { setUpiToggling(false); }
  };
  useEffect(() => { if(tab==="support") fetchTickets(ticketFilter==="all"?null:ticketFilter); }, [tab, ticketFilter]);
  useEffect(() => { if(tab==="settlements") fetchPendingSettlements(); }, [tab]);
  useEffect(() => { fetchPendingSettlements(); }, []); // also load quietly on mount, for the tab count badge
  // Search is filtered client-side against the already-fetched list (below),
  // so only the sort choice (a handful of distinct values) re-hits the server.
  useEffect(() => { if(tab==="customers") fetchCustomers(); }, [tab, customerSort]);
  useEffect(() => { sessionStorage.setItem("sloty-admin-tab", tab); }, [tab]);

  const approve = async (id) => {
    try { await api("PUT", `/stores/${id}/approve`); fetchData(); }
    catch(e) { console.error(e); }
  };

  const reject = async (id) => {
    try { await api("PUT", `/stores/${id}/reject`, { reason:"Does not meet requirements" }); fetchData(); }
    catch(e) { console.error(e); }
  };

  const approved     = allStores.filter(s=>s.isApproved);
  const pendingCount = allStores.filter(s=>!s.isApproved).length;
  const storesByArea = approved.reduce((acc, store) => {
    const area = store.area||store.city||"Other";
    if (!acc[area]) acc[area] = [];
    acc[area].push(store);
    return acc;
  }, {});

  const TABS = [
    { key:"overview",  Icon:LayoutDashboard, label:"Overview"  },
    { key:"approvals", Icon:Clock,           label:`Approvals${pending.length>0?` (${pending.length})`:""}` },
    { key:"stores",    Icon:Store,           label:"Stores"    },
    { key:"customers", Icon:Users,           label:"Customers" },
    { key:"settlements", Icon:IndianRupee,   label:`Settlements${pendingSettlements.length>0?` (${pendingSettlements.length})`:""}` },
    { key:"byarea",    Icon:Map,             label:"By Area"   },
    { key:"support",   Icon:MessageCircle,   label:"Support"   },
  ];

  const filteredCustomers = (customersData?.customers || []).filter(c => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight:"100vh", background:"#0F0F1A", fontFamily:"'Nunito',sans-serif", paddingBottom:20 }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1A1A2E,#2D1B4E)", padding:"44px 20px 20px", borderBottomLeftRadius:28, borderBottomRightRadius:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:4 }}>ADMIN PANEL</p>
            <h2 style={{ fontSize:22, fontWeight:900, color:"#fff" }}>Control Center</h2>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
              <User size={12} color="rgba(255,255,255,0.3)" />
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{user.name}</p>
            </div>
          </div>
          <button onClick={logout} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"9px 14px", color:"rgba(255,255,255,0.4)", fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
            <LogOut size={13} /> Exit
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", padding:"14px 16px 0", gap:8, overflowX:"auto", scrollbarWidth:"none" }}>
        {TABS.map(({ key, Icon, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{ flexShrink:0, padding:"10px 16px", borderRadius:12, border:"none", background:tab===key?C.pri:"rgba(255,255,255,0.06)", color:tab===key?"#fff":"rgba(255,255,255,0.4)", fontWeight:800, cursor:"pointer", fontSize:12, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:6, transition:"all 0.2s" }}>
            <Icon size={13} color={tab===key?"#fff":"rgba(255,255,255,0.4)"} strokeWidth={tab===key?2.5:1.8} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding:16 }}>
        {loading ? <Loader text="Loading..." /> : (
          <>
            {/* ── Overview ── */}
            {tab==="overview" && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:20 }}>
                  <StatCard icon={Store}       value={approved.length}                label="Approved Stores"  color={C.blue}  onClick={() => {setStoresFilter("approved"); setTab("stores");}} />
                  <StatCard icon={Clock}       value={pendingCount}                   label="Pending Approval" color={C.acc}   onClick={() => setTab("approvals")} />
                  <StatCard icon={ClipboardList} value={allStores.length}            label="Total Stores"     color={C.green} onClick={() => {setStoresFilter("all"); setTab("stores");}} />
                  <StatCard icon={Map}         value={Object.keys(storesByArea).length} label="Areas Covered" color={C.pri}   onClick={() => setTab("byarea")} />
                </div>

                <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:18, padding:16, border:"1px solid rgba(255,255,255,0.06)", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <div style={{ width:38, height:38, borderRadius:12, background:(referralEnabled?C.green:C.acc)+"22", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Gift size={18} color={referralEnabled?C.green:C.acc} />
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:900, color:"#fff" }}>Referral Program</p>
                      <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{referralEnabled ? "Live — wallet bonuses are being credited" : "Paused — no wallet bonuses being given"}</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleReferralProgram}
                    disabled={referralToggling}
                    style={{ width:48, height:28, borderRadius:16, background:referralEnabled?C.green:"rgba(255,255,255,0.15)", border:"none", cursor:referralToggling?"not-allowed":"pointer", position:"relative", flexShrink:0, transition:"background 0.2s" }}
                  >
                    <div style={{ width:22, height:22, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:referralEnabled?23:3, transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }} />
                  </button>
                </div>

                <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:18, padding:16, border:"1px solid rgba(255,255,255,0.06)", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <div style={{ width:38, height:38, borderRadius:12, background:(upiEnabled?C.green:C.acc)+"22", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Wallet size={18} color={upiEnabled?C.green:C.acc} />
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:900, color:"#fff" }}>UPI Payments</p>
                      <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{upiEnabled ? "Live — customers can pay online" : "Hidden — customers only see Pay at Store"}</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleUpiPayments}
                    disabled={upiToggling}
                    style={{ width:48, height:28, borderRadius:16, background:upiEnabled?C.green:"rgba(255,255,255,0.15)", border:"none", cursor:upiToggling?"not-allowed":"pointer", position:"relative", flexShrink:0, transition:"background 0.2s" }}
                  >
                    <div style={{ width:22, height:22, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:upiEnabled?23:3, transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }} />
                  </button>
                </div>

                <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:20, padding:16, border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                    <div style={{ width:30, height:30, borderRadius:10, background:C.pri+"22", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <TrendingUp size={14} color={C.pri} />
                    </div>
                    <h3 style={{ fontSize:14, fontWeight:900, color:"#fff" }}>Stores by Category</h3>
                  </div>
                  {CATS.filter(cat=>allStores.some(s=>s.category===cat.id)).map(cat => {
                    const CatIcon = cat.Icon;
                    const count = allStores.filter(s=>s.category===cat.id).length;
                    const pct   = Math.round((count/allStores.length)*100);
                    return (
                      <div key={cat.id} onClick={() => setCatDetail(cat.id)} style={{ padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", cursor:"pointer" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                            <div style={{ width:34, height:34, borderRadius:10, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <CatIcon size={16} color={cat.color} strokeWidth={1.8} />
                            </div>
                            <span style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.75)" }}>{cat.name}</span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:14, fontWeight:900, color:cat.color }}>{count}</span>
                            <ChevronRight size={14} color="rgba(255,255,255,0.25)" />
                          </div>
                        </div>
                        <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:4, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${cat.color},${cat.color}88)`, borderRadius:4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Approvals ── */}
            {tab==="approvals" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>Pending Approvals</h3>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{pending.length} waiting</span>
                </div>

                {pending.length===0 ? (
                  <div style={{ textAlign:"center", padding:"60px 20px" }}>
                    <div style={{ width:64, height:64, borderRadius:22, background:C.green+"22", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                      <CheckCircle size={28} color={C.green} />
                    </div>
                    <p style={{ color:"rgba(255,255,255,0.4)", fontWeight:700 }}>All caught up!</p>
                  </div>
                ) : pending.map(s => {
                  const cat = getCat(s.category);
                  const CatIcon = cat.Icon;
                  return (
                    <div key={s._id} style={{ background:"rgba(255,255,255,0.05)", borderRadius:20, padding:16, marginBottom:14, border:"1px solid rgba(255,255,255,0.08)" }}>
                      {/* Store header */}
                      <div style={{ display:"flex", gap:12, marginBottom:12 }}>
                        <div style={{ width:52, height:52, borderRadius:16, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <CatIcon size={24} color={cat.color} strokeWidth={1.6} />
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <h4 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>{s.name}</h4>
                            <span style={{ fontSize:10, background:cat.color+"33", color:cat.color, padding:"3px 10px", borderRadius:20, fontWeight:800 }}>{cat.name}</span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:4 }}>
                            <User size={11} color="rgba(255,255,255,0.4)" />
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{s.owner?.name}</span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                            <MapPin size={11} color="rgba(255,255,255,0.4)" />
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{s.area&&`${s.area}, `}{s.city}</span>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"10px 14px", marginBottom:12 }}>
                        <div style={{ display:"flex", gap:16 }}>
                          <div>
                            <p style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:2 }}>PHONE</p>
                            <p style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:700 }}>{s.phone}</p>
                          </div>
                          <div>
                            <p style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:2 }}>APPLIED</p>
                            <p style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:700 }}>{new Date(s.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</p>
                          </div>
                          <div>
                            <p style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:2 }}>SERVICES</p>
                            <p style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:700 }}>{s.services?.length||0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Service chips */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                        {s.services?.map((svc,i) => (
                          <span key={i} style={{ fontSize:11, background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.5)", padding:"3px 10px", borderRadius:20 }}>
                            {svc.name} · ₹{svc.price}
                          </span>
                        ))}
                      </div>

                      {/* Store photos — critical for admin to verify the store looks legitimate */}
                      {s.photos?.length > 0 && (
                        <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:12, scrollbarWidth:"none" }}>
                          {s.photos.map((p,i) => (
                            <div key={i} onClick={() => setPhotoViewer({ photos: s.photos, idx: i, storeName: s.name })} style={{ position:"relative", flexShrink:0, cursor:"pointer" }}>
                              <img src={p} alt="" loading="lazy" style={{ width:76, height:76, borderRadius:12, objectFit:"cover", border:"1px solid rgba(255,255,255,0.1)" }} />
                              <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.15)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                <ImageIcon size={14} color="rgba(255,255,255,0.85)" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => approve(s._id)} style={{ flex:1, padding:12, background:`linear-gradient(135deg,${C.green},#00A887)`, color:"#fff", border:"none", borderRadius:12, fontWeight:800, cursor:"pointer", fontSize:13, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                          <CheckCircle size={15} /> Approve
                        </button>
                        <button onClick={() => reject(s._id)} style={{ flex:1, padding:12, background:C.red+"22", color:C.red, border:`1.5px solid ${C.red}33`, borderRadius:12, fontWeight:800, cursor:"pointer", fontSize:13, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                          <XCircle size={15} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── All Stores ── */}
            {tab==="stores" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>All Stores</h3>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{(storesFilter==="approved"?approved:allStores).length} {storesFilter==="approved"?"approved":"total"}</span>
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                  <button onClick={() => setStoresFilter("all")} style={{ padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer", background:storesFilter==="all"?C.pri:"rgba(255,255,255,0.06)", color:storesFilter==="all"?"#fff":"rgba(255,255,255,0.5)", fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>All ({allStores.length})</button>
                  <button onClick={() => setStoresFilter("approved")} style={{ padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer", background:storesFilter==="approved"?C.pri:"rgba(255,255,255,0.06)", color:storesFilter==="approved"?"#fff":"rgba(255,255,255,0.5)", fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>Approved ({approved.length})</button>
                </div>
                {(storesFilter==="approved"?approved:allStores).map(s => {
                  const cat = getCat(s.category);
                  const CatIcon = cat.Icon;
                  return (
                    <div key={s._id} onClick={() => setSelectedStoreId(s._id)} style={{ background:"rgba(255,255,255,0.05)", borderRadius:18, padding:14, marginBottom:12, border:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:12, alignItems:"center", cursor:"pointer" }}>
                      <div style={{ width:46, height:46, borderRadius:14, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <CatIcon size={22} color={cat.color} strokeWidth={1.8} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <p style={{ fontSize:14, fontWeight:900, color:"#fff" }}>{s.name}</p>
                          <div style={{ display:"flex", alignItems:"center", gap:5, background:s.isApproved?C.green+"22":C.acc+"22", padding:"3px 10px", borderRadius:20 }}>
                            <Circle size={6} color={s.isApproved?C.green:C.acc} fill={s.isApproved?C.green:C.acc} />
                            <span style={{ fontSize:10, color:s.isApproved?C.green:C.acc, fontWeight:700 }}>{s.isApproved?"Live":"Pending"}</span>
                          </div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                          <User size={11} color="rgba(255,255,255,0.3)" />
                          <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{s.owner?.name}</span>
                          <span style={{ color:"rgba(255,255,255,0.15)" }}>·</span>
                          <MapPin size={11} color="rgba(255,255,255,0.3)" />
                          <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{s.area&&`${s.area}, `}{s.city}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Customers ── */}
            {tab==="customers" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>Customers</h3>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{customersData?.totals?.totalCustomers ?? 0} total</span>
                </div>

                {customersData && (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
                    <StatCard icon={Users}         value={customersData.totals.totalCustomers}      label="Total Customers"  color={C.blue}  />
                    <StatCard icon={CheckCircle}   value={customersData.totals.activeCustomers}     label="With Bookings"    color={C.green} />
                    <StatCard icon={ClipboardList} value={customersData.totals.totalBookings}       label="Total Bookings"   color={C.pri}   />
                    <StatCard icon={IndianRupee}   value={`₹${customersData.totals.totalSpent}`}    label="Total Spent"      color={C.acc}   />
                  </div>
                )}

                {/* Search */}
                <div style={{ position:"relative", marginBottom:10 }}>
                  <Search size={15} color="rgba(255,255,255,0.3)" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)" }} />
                  <input
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Search by name, phone, or email..."
                    style={{ width:"100%", padding:"11px 14px 11px 38px", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"#fff", fontSize:13, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box" }}
                  />
                </div>

                {/* Sort */}
                <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                  {[["bookings","Most Bookings"],["spent","Highest Spent"],["recent","Newest"]].map(([key,label]) => (
                    <button key={key} onClick={() => setCustomerSort(key)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:"none", cursor:"pointer", background:customerSort===key?C.pri:"rgba(255,255,255,0.06)", color:customerSort===key?"#fff":"rgba(255,255,255,0.5)", fontSize:11, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>
                      {label}
                    </button>
                  ))}
                </div>

                {customersLoading ? (
                  <Loader text="Loading customers..." />
                ) : filteredCustomers.length===0 ? (
                  <div style={{ textAlign:"center", padding:"60px 20px" }}>
                    <div style={{ width:64, height:64, borderRadius:22, background:C.blue+"22", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                      <Users size={28} color={C.blue} />
                    </div>
                    <p style={{ color:"rgba(255,255,255,0.4)", fontWeight:700 }}>{customerSearch?"No customers match your search":"No customers yet"}</p>
                  </div>
                ) : filteredCustomers.map(c => (
                  <div key={c._id} onClick={() => setSelectedCustomerId(c._id)} style={{ background:"rgba(255,255,255,0.05)", borderRadius:18, padding:14, marginBottom:12, border:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:12, alignItems:"center", cursor:"pointer" }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:C.pri+"22", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:16, fontWeight:900, color:C.pri }}>{c.name?.[0]?.toUpperCase()||"?"}</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <p style={{ fontSize:14, fontWeight:900, color:"#fff" }}>{c.name}</p>
                        <p style={{ fontSize:13, fontWeight:900, color:C.green, flexShrink:0 }}>₹{c.totalSpent}</p>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                        <Phone size={11} color="rgba(255,255,255,0.3)" />
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{c.phone||"No phone"}</span>
                        <span style={{ color:"rgba(255,255,255,0.15)" }}>·</span>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{c.totalBookings} booking{c.totalBookings!==1?"s":""}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
                  </div>
                ))}
              </div>
            )}

            {/* ── By Area ── */}
            {tab==="byarea" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>Stores by Area</h3>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{Object.keys(storesByArea).length} areas</span>
                </div>
                {Object.keys(storesByArea).length===0 ? (
                  <div style={{ textAlign:"center", padding:"40px 0" }}>
                    <div style={{ width:56, height:56, borderRadius:18, background:C.blue+"22", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
                      <Map size={24} color={C.blue} />
                    </div>
                    <p style={{ color:"rgba(255,255,255,0.4)", fontWeight:700 }}>No approved stores yet</p>
                  </div>
                ) : Object.entries(storesByArea).map(([area, areaStores]) => (
                  <div key={area} style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                      <div style={{ width:30, height:30, borderRadius:10, background:C.acc+"22", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <MapPin size={14} color={C.acc} />
                      </div>
                      <h4 style={{ fontSize:15, fontWeight:900, color:C.acc }}>{area}</h4>
                      <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
                      <span style={{ fontSize:11, background:C.acc+"22", color:C.acc, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>{areaStores.length} stores</span>
                    </div>
                    {areaStores.map(s => {
                      const cat = getCat(s.category);
                      const CatIcon = cat.Icon;
                      return (
                        <div key={s._id} onClick={() => setSelectedStoreId(s._id)} style={{ background:"rgba(255,255,255,0.04)", borderRadius:14, padding:"12px 14px", marginBottom:8, display:"flex", gap:10, alignItems:"center", border:"1px solid rgba(255,255,255,0.06)", cursor:"pointer" }}>
                          <div style={{ width:38, height:38, borderRadius:11, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <CatIcon size={18} color={cat.color} strokeWidth={1.8} />
                          </div>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:13, fontWeight:800, color:"#fff" }}>{s.name}</p>
                            <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{cat.name}</p>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                            <StarRating rating={s.rating} size={11} emptyColor="rgba(255,255,255,0.15)" />
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginLeft:4 }}>{s.rating}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* ── Settlements ── */}
            {tab==="settlements" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>Pending Settlements</h3>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{pendingSettlements.length} request{pendingSettlements.length!==1?"s":""}</span>
                </div>

                {pendingSettlements.length===0 ? (
                  <div style={{ textAlign:"center", padding:"60px 20px" }}>
                    <div style={{ width:64, height:64, borderRadius:22, background:C.green+"22", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                      <CheckCircle size={28} color={C.green} />
                    </div>
                    <p style={{ color:"rgba(255,255,255,0.4)", fontWeight:700 }}>No pending settlement requests</p>
                  </div>
                ) : pendingSettlements.map(s => (
                  <div key={s._id} style={{ background:"rgba(255,255,255,0.05)", borderRadius:18, padding:16, marginBottom:12, border:"1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div>
                        <p style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{s.store?.name || "Unknown store"}</p>
                        <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{s.store?.area || s.store?.city} · Requested {new Date(s.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}</p>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:2 }}>
                        <IndianRupee size={15} color={C.green} strokeWidth={2.5} />
                        <span style={{ fontSize:18, fontWeight:900, color:C.green }}>{s.amount}</span>
                      </div>
                    </div>
                    <input
                      value={settlementNote[s._id] || ""}
                      onChange={e => setSettlementNote(n => ({ ...n, [s._id]: e.target.value }))}
                      placeholder="Reference note (UTR number, transfer date, etc.) — optional"
                      style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"#fff", fontSize:12, fontFamily:"'Nunito',sans-serif", marginBottom:10, boxSizing:"border-box" }}
                    />
                    <button
                      onClick={() => completeSettlement(s._id)}
                      disabled={completingSettlement===s._id}
                      style={{ width:"100%", padding:"11px", background:C.green, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:13, cursor:completingSettlement===s._id?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif" }}
                    >
                      {completingSettlement===s._id ? "Marking as paid..." : "Mark as Paid Out"}
                    </button>
                    <p style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:8, textAlign:"center" }}>
                      Transfer ₹{s.amount} to this store's owner outside the app first, then mark it here.
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Support ── */}
            {tab==="support" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>Support Tickets</h3>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>{tickets.length} {ticketFilter==="all"?"total":ticketFilter.replace("_"," ")}</span>
                </div>

                <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto" }}>
                  {["open","in_progress","resolved","all"].map(s => (
                    <button key={s} onClick={() => setTicketFilter(s)} style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, border:"none", cursor:"pointer", background:ticketFilter===s?C.pri:"rgba(255,255,255,0.06)", color:ticketFilter===s?"#fff":"rgba(255,255,255,0.4)", fontSize:12, fontWeight:800, fontFamily:"'Nunito',sans-serif" }}>
                      {s==="all"?"All":s.replace("_"," ")}
                    </button>
                  ))}
                </div>

                {tickets.length===0 ? (
                  <div style={{ textAlign:"center", padding:"60px 20px" }}>
                    <div style={{ width:64, height:64, borderRadius:22, background:C.green+"22", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                      <CheckCircle size={28} color={C.green} />
                    </div>
                    <p style={{ color:"rgba(255,255,255,0.4)", fontWeight:700 }}>No {ticketFilter!=="all"?ticketFilter.replace("_"," "):""} tickets</p>
                  </div>
                ) : tickets.map(t => (
                  <div key={t._id} style={{ background:"rgba(255,255,255,0.05)", borderRadius:18, padding:16, marginBottom:12, border:"1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <FileText size={13} color={C.pri} />
                          <p style={{ fontSize:14, fontWeight:900, color:"#fff" }}>{t.subject}</p>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <User size={11} color="rgba(255,255,255,0.4)" />
                          <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{t.userName} ({t.userRole}) · {t.userPhone}</span>
                        </div>
                      </div>
                      <span style={{ fontSize:10, background:C.pri+"22", color:C.pri, padding:"3px 9px", borderRadius:20, fontWeight:700, flexShrink:0 }}>{t.category.replace("_"," ")}</span>
                    </div>
                    <p style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginBottom:12, lineHeight:1.5 }}>{t.message}</p>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{new Date(t.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
                      <div style={{ display:"flex", gap:6 }}>
                        {t.status!=="in_progress" && t.status!=="resolved" && (
                          <button onClick={() => updateTicket(t._id,"in_progress")} style={{ padding:"6px 12px", background:C.acc+"22", color:C.acc, border:"none", borderRadius:8, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>In Progress</button>
                        )}
                        {t.status!=="resolved" && (
                          <button onClick={() => updateTicket(t._id,"resolved")} style={{ padding:"6px 12px", background:C.green+"22", color:C.green, border:"none", borderRadius:8, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:5 }}><CheckCircle size={11} /> Resolve</button>
                        )}
                        {t.status==="resolved" && (
                          <span style={{ fontSize:11, color:C.green, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}><CheckCircle size={12} /> Resolved</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedStoreId && (
        <StoreDetailModal storeId={selectedStoreId} onClose={() => setSelectedStoreId(null)} onRemoved={() => { setSelectedStoreId(null); fetchData(); }} />
      )}

      {selectedCustomerId && (
        <CustomerDetailModal customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />
      )}

      {/* Category detail overlay — drill-down from Overview's "Stores by
          Category", grouped by area/city so an admin can see where a
          category is (or isn't) covered geographically. Every store row
          opens the same Store Detail modal used everywhere else. Its
          z-index is intentionally lower than Store/Customer Detail
          (240 vs 250) so opening a store from within stays visible on
          top instead of being hidden underneath. */}
      {catDetail && (() => {
        const cat = getCat(catDetail);
        const CatIcon = cat.Icon;
        const catStores = allStores.filter(s => s.category === catDetail);
        const byArea = catStores.reduce((acc, s) => {
          const area = s.area || s.city || "Other";
          if (!acc[area]) acc[area] = [];
          acc[area].push(s);
          return acc;
        }, {});
        return (
          <div style={{ position:"fixed", inset:0, background:"#0F0F1A", zIndex:240, overflowY:"auto" }}>
            <div style={{ width:"100%", maxWidth:440, margin:"0 auto", minHeight:"100vh", background:"#0F0F1A" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                <button onClick={() => setCatDetail(null)} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:10, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                  <ArrowLeft size={18} color="#fff" />
                </button>
                <div style={{ width:36, height:36, borderRadius:12, background:cat.color+"22", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <CatIcon size={17} color={cat.color} strokeWidth={1.8} />
                </div>
                <div>
                  <h3 style={{ fontSize:16, fontWeight:900, color:"#fff" }}>{cat.name}</h3>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{catStores.length} store{catStores.length!==1?"s":""} · {Object.keys(byArea).length} location{Object.keys(byArea).length!==1?"s":""}</p>
                </div>
              </div>

              <div style={{ padding:16 }}>
                {catStores.length===0 ? (
                  <div style={{ textAlign:"center", padding:"60px 20px" }}>
                    <p style={{ color:"rgba(255,255,255,0.4)", fontWeight:700 }}>No stores in this category yet</p>
                  </div>
                ) : Object.entries(byArea).map(([area, areaStores]) => (
                  <div key={area} style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                      <div style={{ width:28, height:28, borderRadius:9, background:C.acc+"22", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <MapPin size={13} color={C.acc} />
                      </div>
                      <h4 style={{ fontSize:14, fontWeight:900, color:C.acc }}>{area}</h4>
                      <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
                      <span style={{ fontSize:11, background:C.acc+"22", color:C.acc, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>{areaStores.length}</span>
                    </div>
                    {areaStores.map(s => (
                      <div key={s._id} onClick={() => setSelectedStoreId(s._id)} style={{ background:"rgba(255,255,255,0.04)", borderRadius:14, padding:"12px 14px", marginBottom:8, display:"flex", gap:10, alignItems:"center", border:"1px solid rgba(255,255,255,0.06)", cursor:"pointer" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <p style={{ fontSize:13, fontWeight:800, color:"#fff" }}>{s.name}</p>
                            <div style={{ display:"flex", alignItems:"center", gap:4, background:s.isApproved?C.green+"22":C.acc+"22", padding:"2px 8px", borderRadius:20 }}>
                              <Circle size={5} color={s.isApproved?C.green:C.acc} fill={s.isApproved?C.green:C.acc} />
                              <span style={{ fontSize:9, color:s.isApproved?C.green:C.acc, fontWeight:700 }}>{s.isApproved?"Live":"Pending"}</span>
                            </div>
                          </div>
                          <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{s.city}</p>
                        </div>
                        <ChevronRight size={15} color="rgba(255,255,255,0.25)" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full-screen photo viewer — lets admin inspect store photos clearly before approving */}
      {photoViewer && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:300, display:"flex", justifyContent:"center" }}>
        <div style={{ width:"100%", maxWidth:440, display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 16px 12px" }}>
            <div>
              <p style={{ color:"#fff", fontSize:14, fontWeight:900 }}>{photoViewer.storeName}</p>
              <p style={{ color:"rgba(255,255,255,0.6)", fontSize:12, fontWeight:700 }}>{photoViewer.idx+1} / {photoViewer.photos.length}</p>
            </div>
            <button onClick={() => setPhotoViewer(null)} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:10, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <X size={18} color="#fff" />
            </button>
          </div>
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
            {photoViewer.idx > 0 && (
              <button onClick={() => setPhotoViewer(v => ({ ...v, idx: v.idx-1 }))} style={{ position:"absolute", left:12, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:2 }}>
                <ChevronLeft size={22} color="#fff" />
              </button>
            )}
            <img src={photoViewer.photos[photoViewer.idx]} alt="" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }} />
            {photoViewer.idx < photoViewer.photos.length-1 && (
              <button onClick={() => setPhotoViewer(v => ({ ...v, idx: v.idx+1 }))} style={{ position:"absolute", right:12, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:2 }}>
                <ChevronRight size={22} color="#fff" />
              </button>
            )}
          </div>
          {/* Thumbnail strip for quick jumping between photos */}
          <div style={{ display:"flex", gap:8, padding:"12px 16px 24px", overflowX:"auto", justifyContent:"center", scrollbarWidth:"none" }}>
            {photoViewer.photos.map((p,i) => (
              <img key={i} src={p} alt="" onClick={() => setPhotoViewer(v => ({ ...v, idx: i }))} style={{ width:52, height:52, borderRadius:8, objectFit:"cover", cursor:"pointer", flexShrink:0, border: i===photoViewer.idx ? `2px solid ${C.pri}` : "2px solid transparent", opacity: i===photoViewer.idx ? 1 : 0.5 }} />
            ))}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}