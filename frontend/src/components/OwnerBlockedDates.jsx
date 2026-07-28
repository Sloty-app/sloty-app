import { useState, useEffect } from "react";
import { CalendarOff, Trash2, Plus } from "lucide-react";
import { api } from "../api";
import { C } from "../constants";
import { Card, Btn, Input, Loader } from "./UI";

// SectionHeader isn't part of the shared UI library — defined locally,
// matching the same pattern used elsewhere (e.g. OwnerAnalytics.jsx).
const SectionHeader = ({ icon: Icon, title, color=C.pri }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
    <div style={{ width:32, height:32, borderRadius:10, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Icon size={16} color={color} />
    </div>
    <h3 style={{ fontSize:14, fontWeight:900, color:C.text, margin:0 }}>{title}</h3>
  </div>
);

export default function OwnerBlockedDates() {
  const [storeId,   setStoreId]   = useState(null);
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [newDate,   setNewDate]   = useState("");
  const [wholeDay,  setWholeDay]  = useState(true);
  const [selectedSlots, setSelectedSlots] = useState([]); // array of exact slot-time strings
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [err,       setErr]       = useState("");

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const [entriesRes, storeRes] = await Promise.all([
        api("GET", "/bookings/store/blocked-dates"),
        api("GET", "/stores/owner/my-store"),
      ]);
      setEntries(entriesRes.blockedDates || []);
      setStoreId(storeRes.store._id);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEntries(); }, []);

  // Fetches this store's real slot times for the picked date, the same
  // source of truth the Slots tab and customer booking flow already
  // use — so an owner picks from slots that actually exist, instead of
  // typing a time string that has to happen to match exactly.
  useEffect(() => {
    if (!newDate || wholeDay || !storeId) { setAvailableSlots([]); return; }
    setSlotsLoading(true);
    setSelectedSlots([]); // date changed — previous picks no longer apply
    api("GET", `/bookings/slots/${storeId}?date=${newDate}`)
      .then(res => setAvailableSlots(res.slots || []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [newDate, wholeDay, storeId]);

  const toggleSlot = (time) => {
    setSelectedSlots(s => s.includes(time) ? s.filter(t => t!==time) : [...s, time]);
  };

  const resetForm = () => {
    setNewDate(""); setWholeDay(true); setSelectedSlots([]); setAvailableSlots([]); setNewReason(""); setShowForm(false);
  };

  const saveEntry = async () => {
    if (!newDate) { setErr("Please pick a date"); return; }
    if (!wholeDay && selectedSlots.length === 0) { setErr("Select at least one time slot, or choose Whole Day Off instead"); return; }
    setSaving(true); setErr("");
    try {
      const slots = wholeDay ? [] : selectedSlots;
      await api("POST", "/bookings/store/blocked-dates", { date: newDate, slots, reason: newReason });
      resetForm();
      fetchEntries();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const removeEntry = async (date) => {
    try {
      await api("DELETE", `/bookings/store/blocked-dates/${date}`);
      fetchEntries();
    } catch (e) { setErr(e.message); }
  };

  return (
    <Card>
      <SectionHeader icon={CalendarOff} title="Blocked Dates & Holidays" color={C.red} />
      <p style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.5 }}>
        Block a whole day off (festivals, personal days) or just a few hours on a specific date (stepping out for an errand). Customers will see this date/time as unavailable when booking.
      </p>

      {err && <p style={{ color:C.red, fontSize:12, fontWeight:700, marginBottom:10 }}>{err}</p>}

      {loading ? (
        <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"12px 0" }}>Loading...</p>
      ) : entries.length === 0 && !showForm ? (
        <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"12px 0" }}>No blocked dates yet — your store is bookable on every working day.</p>
      ) : (
        entries.map(e => (
          <div key={e.date} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #F0F2F8" }}>
            <div>
              <p style={{ fontSize:13, fontWeight:800, color:C.text }}>
                {new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric", weekday:"short" })}
              </p>
              <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                {e.slots?.length > 0 ? `Blocked: ${e.slots.join(", ")}` : "Whole day closed"}
                {e.reason && ` · ${e.reason}`}
              </p>
            </div>
            <button
              onClick={() => removeEntry(e.date)}
              style={{ width:32, height:32, borderRadius:10, border:"none", background:C.red+"12", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
            >
              <Trash2 size={14} color={C.red} />
            </button>
          </div>
        ))
      )}

      {showForm ? (
        <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #F0F2F8" }}>
          <Input label="Date" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />

          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <button
              onClick={() => setWholeDay(true)}
              style={{ flex:1, padding:"9px", borderRadius:10, border:`1.5px solid ${wholeDay?C.red:"#E8ECF5"}`, background:wholeDay?C.red+"12":"#fff", color:wholeDay?C.red:C.muted, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}
            >
              Whole Day Off
            </button>
            <button
              onClick={() => setWholeDay(false)}
              style={{ flex:1, padding:"9px", borderRadius:10, border:`1.5px solid ${!wholeDay?C.red:"#E8ECF5"}`, background:!wholeDay?C.red+"12":"#fff", color:!wholeDay?C.red:C.muted, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}
            >
              Specific Hours
            </button>
          </div>

          {!wholeDay && (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:800, color:C.muted, display:"block", marginBottom:8 }}>SELECT TIME SLOTS TO BLOCK</label>
              {!newDate ? (
                <p style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>Pick a date above first</p>
              ) : slotsLoading ? (
                <div style={{ padding:"16px 0" }}><Loader /></div>
              ) : availableSlots.length === 0 ? (
                <p style={{ fontSize:12, color:C.muted, padding:"10px 0" }}>No slots found for this date — check your working hours are set.</p>
              ) : (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {availableSlots.map(slot => {
                    const isSelected = selectedSlots.includes(slot.time);
                    const alreadyUnavailable = slot.isBlocked || slot.isBreak || slot.isBooked;
                    return (
                      <button
                        key={slot.time}
                        onClick={() => !alreadyUnavailable && toggleSlot(slot.time)}
                        disabled={alreadyUnavailable}
                        title={alreadyUnavailable ? (slot.isBooked ? "Already booked" : slot.isBlocked ? "Already blocked" : "Break time") : ""}
                        style={{
                          padding:"8px 14px", borderRadius:20,
                          border:`1.5px solid ${isSelected?C.red:alreadyUnavailable?"#E8ECF5":"#D0D4E0"}`,
                          background:isSelected?C.red+"15":alreadyUnavailable?"#F0F2F8":"#fff",
                          color:isSelected?C.red:alreadyUnavailable?"#B8BCC8":C.text,
                          fontSize:12, fontWeight:700, cursor:alreadyUnavailable?"not-allowed":"pointer",
                          fontFamily:"'Nunito',sans-serif", opacity:alreadyUnavailable?0.6:1,
                        }}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <Input label="Reason (optional, shown to customers)" value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g. Diwali, Personal leave" />

          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <Btn onClick={saveEntry} disabled={saving}>{saving ? "Saving..." : "Save"}</Btn>
            <button onClick={resetForm} style={{ padding:"0 20px", background:C.inputBg, border:"none", borderRadius:14, color:C.text, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{ width:"100%", padding:"11px", marginTop:8, background:C.red+"12", color:C.red, border:`1.5px solid ${C.red}33`, borderRadius:12, fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"'Nunito',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
        >
          <Plus size={15} /> Block a Date
        </button>
      )}
    </Card>
  );
}