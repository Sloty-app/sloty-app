import { useState, useEffect, useId } from "react";
import { Home, Search, BookOpen, User, ArrowLeft, CheckCircle, AlertCircle, X, MapPin, LocateFixed, Star, LayoutDashboard, ListOrdered, MessageCircle, MoreHorizontal } from "lucide-react";
import { C } from "../constants";

const MAPS_KEY = import.meta.env.VITE_MAPS_KEY || "";

export const Badge = ({ color, text }) => (
  <span style={{ fontSize:10, background:color+"22", color, padding:"3px 9px", borderRadius:20, fontWeight:800 }}>{text}</span>
);

export function Card({ children, style={} }) {
  return (
    <div style={{ background:C.card, borderRadius:"var(--radius-lg)", padding:16, marginBottom:14, boxShadow:"var(--shadow-sm)", transition:"box-shadow 0.25s var(--ease, ease), transform 0.2s var(--ease, ease)", ...style }}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, color=C.pri, disabled=false, outline=false, small=false, full=true, style={} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small?"8px 16px":"14px 20px",
      background: disabled?"#E0E4EF": outline?"transparent":color,
      color: disabled?"#AAB": outline?color:"#fff",
      border: outline?`2px solid ${color}`:"none",
      borderRadius: small?"var(--radius-sm)":"var(--radius-md)", fontSize: small?12:14,
      fontWeight:800, cursor:disabled?"not-allowed":"pointer",
      width: full?"100%":"auto",
      boxShadow: (!disabled && !outline) ? `0 6px 18px ${color}33` : "none",
      fontFamily:"'Nunito',sans-serif", transition:"all 0.18s var(--ease, ease)", ...style,
    }}>{children}</button>
  );
}

export function Input({ label, error, ...props }) {
  return (
    <div style={{ marginBottom:12 }}>
      {label && <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:5 }}>{label.toUpperCase()}</label>}
      <input {...props} style={{ width:"100%", padding:"13px 16px", border:`2px solid ${error?"#FF6B6B":"#E8ECF5"}`, borderRadius:"var(--radius-sm)", fontSize:14, color:C.text, background:C.inputBg, outline:"none", fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", transition:"border-color 0.2s var(--ease, ease), box-shadow 0.2s var(--ease, ease)", ...props.style }} />
      {error && (
        <p style={{ color:C.red, fontSize:11, marginTop:4, display:"flex", alignItems:"center", gap:4 }}>
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom:12 }}>
      {label && <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:5 }}>{label.toUpperCase()}</label>}
      <select {...props} style={{ width:"100%", padding:"13px 16px", border:"2px solid #E8ECF5", borderRadius:"var(--radius-sm)", fontSize:14, background:C.inputBg, color:C.text, fontFamily:"'Nunito',sans-serif", boxSizing:"border-box", transition:"border-color 0.2s var(--ease, ease)" }}>
        {children}
      </select>
    </div>
  );
}

export function Loader({ text="Loading...", skeleton=false }) {
  if (skeleton) return (
    <div style={{ padding:"0 0 16px" }}>
      {[1,2,3].map(i => (
        <div key={i} className="fade-in" style={{ background:C.card, borderRadius:"var(--radius-lg)", marginBottom:16, overflow:"hidden", boxShadow:"var(--shadow-sm)", animationDelay:`${i*0.06}s` }}>
          <div style={{ height:120, background:"linear-gradient(90deg,#f0f2f8 25%,#e4e8f0 50%,#f0f2f8 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.5s infinite" }} />
          <div style={{ padding:14 }}>
            <div style={{ height:14, width:"65%", background:"linear-gradient(90deg,#f0f2f8 25%,#e4e8f0 50%,#f0f2f8 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.5s infinite", borderRadius:8, marginBottom:10 }} />
            <div style={{ height:10, width:"40%", background:"linear-gradient(90deg,#f0f2f8 25%,#e4e8f0 50%,#f0f2f8 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.5s infinite", borderRadius:8, marginBottom:14 }} />
            <div style={{ height:44, background:"linear-gradient(90deg,#f0f2f8 25%,#e4e8f0 50%,#f0f2f8 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.5s infinite", borderRadius:14 }} />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px" }}>
      <div style={{ width:40, height:40, border:`4px solid ${C.pri}22`, borderTop:`4px solid ${C.pri}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <p style={{ color:C.muted, marginTop:16, fontWeight:700 }}>{text}</p>
    </div>
  );
}

export function Toast({ message, type="success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type==="error" ? C.red : C.green;
  return (
    <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:bg, color:"#fff", padding:"13px 22px", borderRadius:18, fontSize:13, fontWeight:800, zIndex:9999, boxShadow:`0 10px 32px ${bg}55, 0 2px 8px rgba(0,0,0,0.15)`, display:"flex", alignItems:"center", gap:10, fontFamily:"'Nunito',sans-serif", animation:"slideUp 0.3s var(--ease-spring, ease)", whiteSpace:"nowrap" }}>
      {type==="error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
      {message}
      <div onClick={onClose} style={{ marginLeft:4, cursor:"pointer", opacity:0.8, display:"flex" }}><X size={14} /></div>
    </div>
  );
}

export function TopBar({ title, sub, onBack, dark=false, right }) {
  return (
    <div style={{ background: dark?C.sec:`linear-gradient(135deg,${C.pri},#E0406A)`, padding:"44px 20px 22px", borderBottomLeftRadius:"var(--radius-xl)", borderBottomRightRadius:"var(--radius-xl)", boxShadow:"var(--shadow-md)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {onBack && (
          <button onClick={onBack} style={{ background:"rgba(255,255,255,0.18)", border:"none", borderRadius:12, width:36, height:36, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s var(--ease, ease)" }}>
            <ArrowLeft size={18} color="#fff" />
          </button>
        )}
        <div style={{ flex:1 }}>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginBottom:2 }}>{sub}</p>
          <h2 style={{ fontSize:20, fontWeight:900, color:"#fff", margin:0 }}>{title}</h2>
        </div>
        {right}
      </div>
    </div>
  );
}

const NAV_ICONS = {
  home:      { Icon: Home,           label:"Home"     },
  explore:   { Icon: Search,         label:"Explore"  },
  bookings:  { Icon: BookOpen,       label:"Bookings" },
  profile:   { Icon: User,           label:"Profile"  },
  dashboard: { Icon: LayoutDashboard, label:"Dashboard" },
  queue:     { Icon: ListOrdered,     label:"Queue"     },
  messages:  { Icon: MessageCircle,   label:"Messages"  },
  more:      { Icon: MoreHorizontal,  label:"More"      },
};

export function BottomNav({ tabs, active, onChange }) {
  return (
    <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"var(--app-width)", padding:"8px 0 24px", background:C.card, display:"flex", justifyContent:"space-around", boxShadow:"0 -4px 28px rgba(0,0,0,0.07)", borderTopLeftRadius:"var(--radius-xl)", borderTopRightRadius:"var(--radius-xl)", zIndex:100 }}>
      {tabs.map(([,,key]) => {
        const { Icon, label } = NAV_ICONS[key] || { Icon:Home, label:key };
        const isActive = active === key;
        return (
          <div key={key} onClick={() => onChange(key)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer" }}>
            <div key={isActive ? "on" : "off"} className={isActive ? "nav-pop" : undefined} style={{ width:52, height:32, borderRadius:20, background:isActive?C.pri+"18":"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.25s var(--ease-spring, ease)" }}>
              <Icon size={20} color={isActive?C.pri:C.muted} strokeWidth={isActive?2.5:1.8} />
            </div>
            <span style={{ fontSize:10, color:isActive?C.pri:C.muted, fontWeight:isActive?800:500, transition:"color 0.2s var(--ease, ease)" }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MapPicker({ onSelect, initialCity="" }) {
  const [search,  setSearch]  = useState(initialCity);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchPlaces = async (query) => {
    if (!query || query.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)},India&key=${MAPS_KEY}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setResults(data.results.slice(0,5).map(p => ({
          place_id: p.place_id,
          description: p.formatted_address,
          structured_formatting: {
            main_text: p.address_components[0]?.long_name || p.formatted_address,
            secondary_text: p.formatted_address,
          },
          geometry: p.geometry,
        })));
      } else { setResults([]); }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const selectPlace = (place) => {
    setSearch(place.description);
    setResults([]);
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?place_id=${place.place_id}&key=${MAPS_KEY}`)
      .then(r => r.json())
      .then(data => {
        if (data.results && data.results[0]) {
          const components = data.results[0].address_components;
          let city = "", area = "";
          components.forEach(comp => {
            if (comp.types.includes("locality")) city = comp.long_name;
            if (comp.types.includes("sublocality_level_1") || comp.types.includes("sublocality")) area = comp.long_name;
          });
          const loc = data.results[0].geometry?.location;
          onSelect({ city: city || place.structured_formatting.main_text, area, lat: loc?.lat ?? null, lng: loc?.lng ?? null });
        }
      });
  };

  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, display:"block", marginBottom:5 }}>YOUR CITY / AREA</label>
      <div style={{ position:"relative" }}>
        <input value={search} onChange={e => { setSearch(e.target.value); searchPlaces(e.target.value); }} placeholder="Search your city or area..." style={{ width:"100%", padding:"13px 16px 13px 42px", border:"2px solid #E8ECF5", borderRadius:12, fontSize:14, color:C.text, background:C.inputBg, outline:"none", fontFamily:"'Nunito',sans-serif", boxSizing:"border-box" }} />
        <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", display:"flex" }}><MapPin size={16} color={C.muted} /></span>
        {loading && (
          <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)" }}>
            <div style={{ width:14, height:14, border:`2px solid ${C.pri}33`, borderTop:`2px solid ${C.pri}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
          </span>
        )}
      </div>
      {results.length > 0 && (
        <div style={{ background:C.card, borderRadius:12, border:"2px solid #E8ECF5", marginTop:4, overflow:"hidden", boxShadow:"0 8px 28px rgba(0,0,0,0.12)", position:"relative", zIndex:10 }}>
          {results.map((p,i) => (
            <div key={p.place_id} onClick={() => selectPlace(p)} style={{ padding:"12px 16px", borderBottom:i<results.length-1?"1px solid #F0F2F8":"none", cursor:"pointer", display:"flex", gap:10, alignItems:"center", transition:"background 0.15s var(--ease, ease)" }}>
              <MapPin size={16} color={C.pri} />
              <div>
                <p style={{ fontSize:13, fontWeight:700, color:C.text }}>{p.structured_formatting?.main_text}</p>
                <p style={{ fontSize:11, color:C.muted }}>{p.structured_formatting?.secondary_text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <>
      <div className="bottom-sheet__backdrop" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="bottom-sheet__handle" />
        {title && <h3 style={{ fontSize: 17, fontWeight: 900, color: C.text, marginBottom: 16 }}>{title}</h3>}
        {children}
      </div>
    </>
  );
}

export function SlotPicker({ slots, selected, onSelect, loading, isWholeDayClosed, closureReason }) {
  if (loading) return <Loader text="Loading slots..." />;
  if (isWholeDayClosed) {
    return (
      <div style={{ textAlign:"center", padding:"28px 16px", background:"#FFF3E0", borderRadius:14, border:"1.5px solid #FF980033" }}>
        <p style={{ fontSize:14, fontWeight:800, color:"#B36B00", marginBottom:4 }}>Closed on this date</p>
        <p style={{ fontSize:12, color:"#B36B00" }}>{closureReason || "This store is unavailable on this date"} — please pick a different day.</p>
      </div>
    );
  }
  if (!slots?.length) return <p style={{ color: C.muted, textAlign: "center", padding: "20px 0", fontSize: 13 }}>No slots available</p>;

  return (
    <div className="slot-grid">
      {slots.map((slot) => {
        const isSelected = selected === slot.time;
        const cls = !slot.available
          ? "slot-chip slot-chip--disabled"
          : isSelected
            ? "slot-chip slot-chip--selected"
            : "slot-chip slot-chip--available";
        const bg = slot.isPast ? "#EEEEEE" : slot.isBreak ? "#FFF8E8" : slot.isBlocked ? "#F0E8FF" : slot.isBooked ? "#FFE8E8" : undefined;
        const color = slot.isPast ? "#BBB" : slot.isBreak ? "#FFB800" : slot.isBlocked ? "#B06AFF" : slot.isBooked ? C.red : undefined;

        return (
          <div
            key={slot.time}
            className={cls}
            style={!isSelected && !slot.available ? { background: bg, color } : undefined}
            onClick={() => slot.available && onSelect(slot.time)}
          >
            <span>{slot.time}</span>
            {slot.isPast && <div style={{ fontSize: 8, fontWeight: 900 }}>PAST</div>}
            {slot.isBooked && <div style={{ fontSize: 8, fontWeight: 900 }}>TAKEN</div>}
            {slot.isBreak && <div style={{ fontSize: 8, fontWeight: 900 }}>{slot.breakLabel || "BREAK"}</div>}
            {slot.isBlocked && <div style={{ fontSize: 8, fontWeight: 900 }}>BLOCKED</div>}
            {/* Pooled-capacity stores: show remaining seats at this slot,
                e.g. "2 left" — only relevant when capacity > 1 and the
                slot is genuinely still bookable. */}
            {slot.available && typeof slot.spotsLeft === "number" && slot.spotsLeft >= 1 && (
              <div style={{ fontSize: 8, fontWeight: 800, color: isSelected ? "rgba(255,255,255,0.85)" : C.green, marginTop: 1 }}>
                {slot.spotsLeft} left
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LocationDetector({ onDetected }) {
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [detected, setDetected] = useState(null); // { city, area, lat, lng, accuracy, source }

  const reverseGeocode = async (latitude, longitude, accuracy, source) => {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${MAPS_KEY}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error("no_results");

    // Small villages often aren't tagged as "locality" in Google's
    // data — check progressively broader admin levels so rural
    // areas resolve to something more specific than the nearest
    // big town. We scan all results (not just the first) and take
    // the most specific match across common rural-relevant types.
    const PRIORITY = [
      "locality", "sublocality", "sublocality_level_1",
      "administrative_area_level_4", "administrative_area_level_3",
      "administrative_area_level_2",
    ];
    let city = "", area = "";
    for (const result of data.results) {
      for (const type of PRIORITY) {
        const match = result.address_components.find(c => c.types.includes(type));
        if (match && !city) city = match.long_name;
      }
      const subMatch = result.address_components.find(c => c.types.includes("sublocality_level_1") || c.types.includes("sublocality"));
      if (subMatch && !area) area = subMatch.long_name;
      if (city) break;
    }
    return { city, area, lat:latitude, lng:longitude, accuracy, source };
  };

  // Last-resort fallback when the browser can't get any device location
  // at all (permission denied, no GPS/WiFi signal, etc.) — approximates
  // city from the network's IP address. Far less precise than GPS but
  // still useful for "show stores near you" rather than nothing at all.
  const detectViaIP = async () => {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    if (!data.city) throw new Error("ip_lookup_failed");
    return { city: data.city, area: "", lat: data.latitude, lng: data.longitude, accuracy: 50000, source: "ip" };
  };

  const getPosition = (options) => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

  const detect = async () => {
    setLoading(true); setErr(""); setDetected(null);

    if (!navigator.geolocation) {
      try {
        const result = await detectViaIP();
        setDetected(result); onDetected(result);
      } catch { setErr("Location isn't available on this device. Please search manually below."); }
      finally { setLoading(false); }
      return;
    }

    try {
      // Stage 1 — high-accuracy GPS first. On a real phone this is fast
      // AND precise (5-20m), since the device has an actual GPS chip —
      // this is the common case for a booking app used on the go, so it
      // should get the best fix by default rather than settling for a
      // rougher network-based guess. A moderate 8s timeout keeps this
      // from hanging too long on devices that lack GPS (laptops).
      const pos = await getPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
      const { latitude, longitude, accuracy } = pos.coords;
      const result = await reverseGeocode(latitude, longitude, accuracy, "device");
      setDetected(result); onDetected(result);
    } catch (preciseErr) {
      // Stage 2 — GPS failed or timed out (typical on a laptop with no
      // GPS chip). Fall back to fast network/WiFi-based positioning,
      // which resolves in ~1-2s and is good enough for "stores near you"
      // even if it's not pinpoint-precise.
      try {
        const pos = await getPosition({ enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 });
        const { latitude, longitude, accuracy } = pos.coords;
        const result = await reverseGeocode(latitude, longitude, accuracy, "device");
        setDetected(result); onDetected(result);
      } catch (fastErr) {
        // Stage 3 — device geolocation failed entirely. Fall back to an
        // approximate IP-based location rather than leaving the user stuck.
        try {
          const result = await detectViaIP();
          setDetected(result); onDetected(result);
        } catch {
          // Report the real reason the device geolocation failed, since
          // "permission denied" vs "timed out" vs "unavailable" all need
          // different guidance and were previously all shown as the same
          // generic (and often wrong) message.
          const code = fastErr?.code ?? preciseErr?.code;
          if (code === 1) setErr("Location permission denied. Enable it in your browser settings, or search manually below.");
          else if (code === 3) setErr("Location detection timed out. Please search your area manually below.");
          else setErr("Couldn't detect your location. Please search manually below.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const lowAccuracy = detected?.accuracy && detected.accuracy > 3000;

  return (
    <div>
      <button onClick={detect} disabled={loading} style={{ width:"100%", padding:"12px", background:loading?"#f0f0f0":`${C.blue}15`, color:loading?C.muted:C.blue, border:`2px solid ${loading?"#e0e0e0":C.blue+"33"}`, borderRadius:12, fontSize:13, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:"'Nunito',sans-serif", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s var(--ease, ease)" }}>
        <LocateFixed size={15} color={loading?C.muted:C.blue} />
        {loading ? "Detecting location..." : "Use My Current Location"}
      </button>
      {err && (
        <p style={{ color:C.red, fontSize:11, marginBottom:8, display:"flex", alignItems:"center", gap:4 }}>
          <AlertCircle size={11} /> {err}
        </p>
      )}
      {detected && (
        <div style={{ background: detected.source==="ip" ? "#FFF3E0" : lowAccuracy ? "#FFF8E1" : "#F0FAF6", border:`1.5px solid ${detected.source==="ip"?"#FF9800":lowAccuracy?"#FFD23F":"#00C9A7"}${detected.source==="ip"?"66":"33"}`, borderRadius:12, padding:"10px 14px", marginBottom:10 }}>
          <p style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:2 }}>
            Detected: {detected.area ? `${detected.area}, ` : ""}{detected.city || "Unknown area"}
          </p>
          {detected.source === "ip" ? (
            <p style={{ fontSize:11.5, color:"#B36B00", fontWeight:700, lineHeight:1.4 }}>
              ⚠️ This is a rough network-based guess, not your real GPS location — it can be off by 100km or more. Please double check this is correct, or search your area manually below instead.
            </p>
          ) : (
            <p style={{ fontSize:11, color:C.muted }}>
              GPS accuracy: ±{Math.round(detected.accuracy)}m{lowAccuracy && " — that's quite wide. If this doesn't look right, search your area manually below instead."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a 1-5 star row for a given average rating, with proper
 * half-star precision — a 4.5 rating shows 4 full stars + 1 visually
 * half-filled star, not just rounded to the nearest whole star.
 *
 * Half-fill is done by layering a full outline star underneath, then
 * an absolutely-positioned filled star clipped to 50% width on top —
 * lucide-react's Star icon has no built-in half-fill support, so this
 * is the standard, reliable way to fake it with two overlaid icons
 * rather than needing a custom hand-built SVG path.
 */
export function StarRating({ rating = 0, size = 12, emptyColor = "#E8ECF5" }) {
  const safeRating = Number(rating) || 0;
  const fraction = safeRating - Math.floor(safeRating); // 0 to <1
  const gradientId = useId().replace(/:/g, "");
  return (
    <div style={{ display:"flex", alignItems:"center", gap:1 }}>
      {[1,2,3,4,5].map(n => {
        const isFull = n <= Math.floor(safeRating);
        // A fraction of 0.75+ rounds up to a full star instead of a
        // half (e.g. 4.8 shows 5 full stars, not 4-and-a-half) —
        // matches how most rating displays handle values this close
        // to the next whole star.
        const roundsUpToFull = !isFull && n === Math.floor(safeRating) + 1 && fraction >= 0.75;
        const showHalf = !isFull && !roundsUpToFull && n === Math.floor(safeRating) + 1 && fraction >= 0.25;

        if (isFull || roundsUpToFull) {
          return <Star key={n} size={size} color={C.acc} fill={C.acc} strokeWidth={1.5} />;
        }
        if (showHalf) {
          // A rectangular clip cuts straight through the star's actual
          // outline at an angle that doesn't follow its points, leaving
          // a visually broken-looking sliver. A gradient fill instead
          // respects the star's real shape — the fill transitions from
          // solid gold to transparent exactly at the midpoint, staying
          // inside the path's own outline the whole way.
          const id = `star-half-${gradientId}-${n}`;
          return (
            <svg key={n} width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink:0 }}>
              <defs>
                <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="50%" stopColor={C.acc} />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d="M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z"
                fill={`url(#${id})`}
                stroke={emptyColor}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          );
        }
        return <Star key={n} size={size} color={emptyColor} fill="transparent" strokeWidth={1.5} />;
      })}
    </div>
  );
}