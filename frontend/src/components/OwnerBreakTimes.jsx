import { useState, useEffect } from "react";
import { Coffee, Trash2, Plus } from "lucide-react";
import { api } from "../api";
import { C } from "../constants";
import { Card, Btn, Input } from "./UI";

// SectionHeader isn't part of the shared UI library — defined locally,
// matching the same pattern used in OwnerBlockedDates.jsx.
const SectionHeader = ({ icon: Icon, title, color=C.pri }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
    <div style={{ width:32, height:32, borderRadius:10, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Icon size={16} color={color} />
    </div>
    <h3 style={{ fontSize:14, fontWeight:900, color:C.text, margin:0 }}>{title}</h3>
  </div>
);

// Self-contained, like OwnerBlockedDates — fetches and saves its own
// data independently, so it can be rendered from anywhere (Slots tab,
// Settings, wherever) without needing to be threaded through parent
// component state or props.
export default function OwnerBreakTimes() {
  const [storeId,   setStoreId]   = useState(null);
  const [breaks,     setBreaks]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");
  const [savedMsg,   setSavedMsg]   = useState("");

  const fetchBreaks = async () => {
    setLoading(true);
    try {
      const res = await api("GET", "/stores/owner/my-store");
      setStoreId(res.store._id);
      setBreaks(res.store.breakTimes || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBreaks(); }, []);

  const addBreak = () => setBreaks(b => [...b, { open:"", close:"", label:"" }]);
  const removeBreak = (i) => setBreaks(b => b.filter((_,j) => j!==i));
  const updateBreak = (i, field, value) => setBreaks(b => b.map((x,j) => j===i ? {...x,[field]:value} : x));

  const save = async () => {
    setSaving(true); setErr(""); setSavedMsg("");
    try {
      await api("PUT", `/stores/${storeId}`, { breakTimes: breaks });
      setSavedMsg("Saved!");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <Card>
      <SectionHeader icon={Coffee} title="Break Times" color={C.acc} />
      <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"12px 0" }}>Loading...</p>
    </Card>
  );

  return (
    <Card>
      <SectionHeader icon={Coffee} title="Break Times" color={C.acc} />
      <p style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.5 }}>
        Recurring daily breaks — lunch, prayer time, etc. These block the same time window every day, unlike Blocked Dates which are one-off.
      </p>

      {err && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginBottom:10 }}>{err}</p>}

      {breaks.length === 0 && (
        <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"12px 0" }}>No daily breaks set — your full working hours are bookable.</p>
      )}

      {breaks.map((b,i) => (
        <div key={i} style={{ marginBottom:14, paddingBottom:14, borderBottom: i<breaks.length-1 ? "1px solid #F0F2F8" : "none" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:800, color:C.muted }}>BREAK {i+1}</span>
            <button onClick={() => removeBreak(i)} style={{ background:C.red+"15", color:C.red, border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
              <Trash2 size={11} /> Remove
            </button>
          </div>
          <input value={b.label||""} onChange={e=>updateBreak(i,"label",e.target.value)} placeholder="e.g. Lunch Break" style={{ width:"100%", padding:"10px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontFamily:"'Nunito',sans-serif", marginBottom:10, boxSizing:"border-box", background:C.inputBg }} />
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:10, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>FROM</label>
              <input type="time" value={b.open||""} onChange={e=>updateBreak(i,"open",e.target.value)} style={{ width:"100%", padding:"10px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg }} />
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:10, fontWeight:800, color:C.muted, display:"block", marginBottom:5 }}>TO</label>
              <input type="time" value={b.close||""} onChange={e=>updateBreak(i,"close",e.target.value)} style={{ width:"100%", padding:"10px 14px", border:"2px solid #E8ECF5", borderRadius:10, fontSize:13, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", background:C.inputBg }} />
            </div>
          </div>
        </div>
      ))}

      <button onClick={addBreak} style={{ padding:"10px 20px", background:C.acc+"18", color:"#B8860B", border:`2px dashed ${C.acc}`, borderRadius:12, cursor:"pointer", fontWeight:800, fontFamily:"'Nunito',sans-serif", fontSize:13, width:"100%", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
        <Plus size={14} /> Add Break
      </button>

      <Btn onClick={save} disabled={saving}>{saving ? "Saving..." : savedMsg || "Save Break Times"}</Btn>
    </Card>
  );
}