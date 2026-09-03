import { useState, useEffect } from "react";
import { Tag, Plus, X, Trash2, Power, Calendar, Percent, IndianRupee, Gift } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";

/**
 * Owner-side offers management — self-contained tab. Lets the owner
 * create a discount offer (which fans out a push notification to every
 * customer in the store's city), and pause/delete existing ones.
 */
export default function OwnerOffers({ services }) {
  const [offers,  setOffers]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const [form, setForm] = useState({
    title: "", description: "", discountType: "percentage", discountValue: "",
    minBookingValue: "", maxDiscountAmount: "", applicableServices: [],
    validFrom: "", validUntil: "",
  });

  const fetchOffers = () => {
    setLoading(true);
    api("GET", "/offers/owner/my-offers")
      .then(res => setOffers(res.offers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOffers(); }, []);

  const resetForm = () => {
    setForm({ title:"", description:"", discountType:"percentage", discountValue:"", minBookingValue:"", maxDiscountAmount:"", applicableServices:[], validFrom:"", validUntil:"" });
    setErr("");
  };

  const toggleService = (name) => {
    setForm(f => ({ ...f, applicableServices: f.applicableServices.includes(name) ? f.applicableServices.filter(s=>s!==name) : [...f.applicableServices, name] }));
  };

  const submitOffer = async () => {
    setErr("");
    if (!form.title.trim()) return setErr("Please give your offer a title");
    if (form.discountType !== "free" && (!form.discountValue || Number(form.discountValue) <= 0)) return setErr("Enter a valid discount amount");
    if (!form.validFrom || !form.validUntil) return setErr("Please set a start and end date");

    setSaving(true);
    try {
      await api("POST", "/offers", {
        ...form,
        discountValue: Number(form.discountValue),
        minBookingValue: Number(form.minBookingValue) || 0,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
      });
      setShowForm(false);
      resetForm();
      fetchOffers();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const toggleOffer = async (id) => {
    try { await api("PUT", `/offers/${id}/toggle`, {}); fetchOffers(); }
    catch (e) { console.error(e.message); }
  };

  const deleteOffer = async (id) => {
    if (!confirm("Delete this offer permanently?")) return;
    try { await api("DELETE", `/offers/${id}`); fetchOffers(); }
    catch (e) { console.error(e.message); }
  };

  const isExpired = (offer) => new Date(offer.validUntil) < new Date();

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h3 style={{ fontSize:16, fontWeight:900, color:C.text }}>Offers</h3>
        <button onClick={() => setShowForm(true)} style={{ display:"flex", alignItems:"center", gap:6, background:C.pri, border:"none", borderRadius:12, padding:"9px 16px", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
          <Plus size={14} /> Create Offer
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"40px 0" }}>
          <div style={{ width:32, height:32, border:`3px solid ${C.pri}22`, borderTop:`3px solid ${C.pri}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />
        </div>
      ) : offers.length === 0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px" }}>
          <div style={{ width:56, height:56, borderRadius:18, background:C.pri+"15", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
            <Tag size={24} color={C.pri} />
          </div>
          <p style={{ fontSize:13, color:C.muted, fontWeight:700 }}>No offers yet</p>
          <p style={{ fontSize:11, color:C.muted, marginTop:4 }}>Create one to notify customers in your area</p>
        </div>
      ) : offers.map(o => {
        const expired = isExpired(o);
        return (
          <div key={o._id} style={{ background:C.card, borderRadius:16, padding:"14px 16px", marginBottom:10, boxShadow:"0 2px 8px rgba(0,0,0,0.04)", opacity: expired ? 0.6 : 1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:900, color:C.text }}>{o.title}</p>
                <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                  {o.discountType === "free" ? (
                    <>
                      <Gift size={11} color={C.green} />
                      <span style={{ fontSize:12, fontWeight:800, color:C.green }}>FREE</span>
                    </>
                  ) : (
                    <>
                      {o.discountType === "percentage" ? <Percent size={11} color={C.pri} /> : <IndianRupee size={11} color={C.pri} />}
                      <span style={{ fontSize:12, fontWeight:800, color:C.pri }}>{o.discountType === "percentage" ? `${o.discountValue}% off` : `₹${o.discountValue} off`}</span>
                    </>
                  )}
                  {o.minBookingValue > 0 && <span style={{ fontSize:11, color:C.muted }}>· min ₹{o.minBookingValue}</span>}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => toggleOffer(o._id)} title={o.isActive?"Pause":"Activate"} style={{ background: o.isActive ? C.green+"15" : "#F0F2F8", border:"none", borderRadius:8, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                  <Power size={13} color={o.isActive ? C.green : C.muted} />
                </button>
                <button onClick={() => deleteOffer(o._id)} style={{ background:C.red+"12", border:"none", borderRadius:8, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                  <Trash2 size={13} color={C.red} />
                </button>
              </div>
            </div>
            {o.description && <p style={{ fontSize:12, color:C.muted, marginBottom:6 }}>{o.description}</p>}
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <Calendar size={11} color={C.muted} />
              <span style={{ fontSize:11, color:C.muted }}>
                {new Date(o.validFrom).toLocaleDateString("en-IN",{day:"numeric",month:"short"})} – {new Date(o.validUntil).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
              </span>
              {expired && <span style={{ fontSize:10, color:C.red, fontWeight:800, marginLeft:6 }}>EXPIRED</span>}
              {!expired && !o.isActive && <span style={{ fontSize:10, color:C.muted, fontWeight:800, marginLeft:6 }}>PAUSED</span>}
            </div>
          </div>
        );
      })}

      {/* Create offer form — bottom sheet style */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"24px 20px 32px", width:"100%", maxWidth:"var(--app-width)", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <h3 style={{ fontSize:17, fontWeight:900, color:C.text }}>Create Offer</h3>
              <button onClick={() => {setShowForm(false); resetForm();}} style={{ background:"#F0F2F8", border:"none", borderRadius:10, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                <X size={16} color={C.muted} />
              </button>
            </div>

            <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>OFFER TITLE</label>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Festive Season Special" style={{ width:"100%", padding:"12px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, fontFamily:"'Nunito',sans-serif", marginBottom:14, boxSizing:"border-box" }} />

            <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>DESCRIPTION (OPTIONAL)</label>
            <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Short description shown to customers" style={{ width:"100%", padding:"12px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, fontFamily:"'Nunito',sans-serif", marginBottom:14, boxSizing:"border-box" }} />

            <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>DISCOUNT TYPE</label>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <button onClick={() => setForm(f=>({...f,discountType:"percentage"}))} style={{ flex:1, padding:"11px", borderRadius:12, border:`2px solid ${form.discountType==="percentage"?C.pri:"#E8ECF5"}`, background:form.discountType==="percentage"?C.pri+"10":"#fff", color:form.discountType==="percentage"?C.pri:C.muted, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <Percent size={14} /> Percentage
              </button>
              <button onClick={() => setForm(f=>({...f,discountType:"flat"}))} style={{ flex:1, padding:"11px", borderRadius:12, border:`2px solid ${form.discountType==="flat"?C.pri:"#E8ECF5"}`, background:form.discountType==="flat"?C.pri+"10":"#fff", color:form.discountType==="flat"?C.pri:C.muted, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <IndianRupee size={14} /> Flat Amount
              </button>
              <button onClick={() => setForm(f=>({...f,discountType:"free"}))} style={{ flex:1, padding:"11px", borderRadius:12, border:`2px solid ${form.discountType==="free"?C.green:"#E8ECF5"}`, background:form.discountType==="free"?C.green+"10":"#fff", color:form.discountType==="free"?C.green:C.muted, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <Gift size={14} /> Free
              </button>
            </div>

            {form.discountType !== "free" && (
              <>
                <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>
                  {form.discountType==="percentage" ? "DISCOUNT PERCENTAGE" : "DISCOUNT AMOUNT (₹)"}
                </label>
                <input value={form.discountValue} onChange={e=>setForm(f=>({...f,discountValue:e.target.value.replace(/\D/g,"")}))} onWheel={e=>e.target.blur()} type="number" placeholder={form.discountType==="percentage"?"20":"50"} style={{ width:"100%", padding:"12px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, fontFamily:"'Nunito',sans-serif", marginBottom:14, boxSizing:"border-box" }} />
              </>
            )}

            {form.discountType === "free" && (
              <div style={{ background:C.green+"12", borderRadius:12, padding:"12px 14px", marginBottom:14, display:"flex", gap:8, alignItems:"flex-start" }}>
                <Gift size={14} color={C.green} style={{ flexShrink:0, marginTop:1 }} />
                <p style={{ fontSize:12, color:C.green, fontWeight:700, lineHeight:1.4 }}>Selected service(s) will be completely free for customers during the dates you set below — nothing to pay at all.</p>
              </div>
            )}

            {form.discountType === "percentage" && (
              <>
                <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>MAX DISCOUNT CAP (₹, OPTIONAL)</label>
                <input value={form.maxDiscountAmount} onChange={e=>setForm(f=>({...f,maxDiscountAmount:e.target.value.replace(/\D/g,"")}))} onWheel={e=>e.target.blur()} type="number" placeholder="e.g. 100 (caps a 50% discount)" style={{ width:"100%", padding:"12px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, fontFamily:"'Nunito',sans-serif", marginBottom:14, boxSizing:"border-box" }} />
              </>
            )}

            <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>MIN. BOOKING VALUE (₹, OPTIONAL)</label>
            <input value={form.minBookingValue} onChange={e=>setForm(f=>({...f,minBookingValue:e.target.value.replace(/\D/g,"")}))} onWheel={e=>e.target.blur()} type="number" placeholder="e.g. 200 — offer only applies above this" style={{ width:"100%", padding:"12px 14px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, fontFamily:"'Nunito',sans-serif", marginBottom:14, boxSizing:"border-box" }} />

            {services?.length > 0 && (
              <>
                <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:8 }}>APPLIES TO (leave empty = all services)</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
                  {services.map(s => (
                    <button key={s.name} onClick={() => toggleService(s.name)} style={{ padding:"7px 14px", borderRadius:20, border:`1.5px solid ${form.applicableServices.includes(s.name)?C.pri:"#E8ECF5"}`, background:form.applicableServices.includes(s.name)?C.pri+"12":"#fff", color:form.applicableServices.includes(s.name)?C.pri:C.muted, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ display:"flex", gap:10, marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>START DATE</label>
                <input value={form.validFrom} onChange={e=>setForm(f=>({...f,validFrom:e.target.value}))} type="date" style={{ width:"100%", padding:"11px 12px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:13, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box" }} />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>END DATE</label>
                <input value={form.validUntil} onChange={e=>setForm(f=>({...f,validUntil:e.target.value}))} type="date" style={{ width:"100%", padding:"11px 12px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:13, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box" }} />
              </div>
            </div>

            {err && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginBottom:12 }}>{err}</p>}

            <button onClick={submitOffer} disabled={saving} style={{ width:"100%", padding:"14px", background:saving?"#E0E4EF":`linear-gradient(100deg,${C.pri},#DB2777)`, color:saving?"#AAB":"#fff", border:"none", borderRadius:14, fontSize:15, fontWeight:800, cursor:saving?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif" }}>
              {saving ? "Creating..." : "Create & Notify Customers"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}