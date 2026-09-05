import { useState, useEffect, useRef } from "react";
import { Star, MapPin, ChevronRight, Tag, Zap } from "lucide-react";
import { C, getCat } from "../constants";
import { getStoreCover, formatRating } from "../utils/storeMedia";
import { formatDistance } from "../utils/geo";

/* Home-screen building blocks in the Swiggy/Zomato mould: an
   auto-advancing offers carousel up top, horizontal snap-scroll rails
   ("Top rated near you", "Open now") before the full list, a rotating
   search placeholder, and a number that ticks when it changes. */

/** Cycles through search prompts ("Search for 'haircut'"…) every few
 *  seconds — the small, familiar Swiggy touch that makes the search
 *  bar feel alive rather than a static field. Returns the current
 *  term plus a key so the caller can re-animate on each change. */
export function useRotatingPlaceholder(terms, intervalMs = 2600) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!terms?.length) return;
    const t = setInterval(() => setIdx(i => (i + 1) % terms.length), intervalMs);
    return () => clearInterval(t);
  }, [terms, intervalMs]);
  return { term: terms?.[idx] || "", key: idx };
}

/** A number that plays a short "tick in" animation whenever its value
 *  changes — used for live queue position so "3 people ahead" visibly
 *  ticks down to 2 instead of silently swapping. */
export function AnimatedNumber({ value, style }) {
  return <span key={value} className="tick-in" style={{ display:"inline-block", ...style }}>{value}</span>;
}

/** Zomato-style green rating pill. */
export function RatingPill({ rating, size = "sm" }) {
  const r = Number(rating) || 0;
  if (!r) return null;
  const big = size === "lg";
  return (
    <span className="rating-pill" style={big ? { fontSize:13, padding:"5px 9px", borderRadius:8 } : undefined}>
      {formatRating(r)} <Star size={big ? 12 : 10} color="#fff" fill="#fff" strokeWidth={0} />
    </span>
  );
}

const offerLabel = (o) =>
  o.discountType === "free" ? "FREE" : o.discountType === "percentage" ? `${o.discountValue}% OFF` : `₹${o.discountValue} OFF`;

/** Auto-advancing banner carousel of live offers. Each banner is a
 *  store with an active offer; tapping opens the store. Advances every
 *  3.5s, pauses while the user is touching it, and the dots below
 *  reflect the current slide. */
export function OffersCarousel({ stores, offersMap, onSelect }) {
  const items = (stores || []).filter(s => offersMap?.[s._id]);
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      if (pausedRef.current || !ref.current) return;
      const next = (active + 1) % items.length;
      const el = ref.current;
      const child = el.children[next];
      if (child) el.scrollTo({ left: child.offsetLeft - 16, behavior: "smooth" });
      setActive(next);
    }, 3500);
    return () => clearInterval(t);
  }, [active, items.length]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || !el.children.length) return;
    const w = el.children[0].offsetWidth + 12;
    const i = Math.round(el.scrollLeft / w);
    if (i !== active && i >= 0 && i < items.length) setActive(i);
  };

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"0 16px", marginBottom:12 }}>
        <Zap size={16} color={C.priDark} fill={C.priDark} strokeWidth={1.5} />
        <h2 style={{ fontSize:17, fontWeight:900, color:C.text }}>Deals for you</h2>
      </div>
      <div
        ref={ref}
        className="rail"
        onScroll={onScroll}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
      >
        {items.map(s => {
          const o = offersMap[s._id];
          const cat = getCat(s.category);
          return (
            <div
              key={s._id}
              onClick={() => onSelect?.(s)}
              className="pressable"
              style={{
                width:"calc(100% - 32px)", height:150, borderRadius:20, position:"relative", overflow:"hidden", cursor:"pointer",
                backgroundImage:`url(${getStoreCover(s)})`, backgroundSize:"cover", backgroundPosition:"center",
                boxShadow:"0 10px 30px rgba(0,0,0,0.14)",
              }}
            >
              <div style={{ position:"absolute", inset:0, background:`linear-gradient(105deg, ${cat.color}EE 0%, ${cat.color}99 40%, rgba(0,0,0,0.15) 100%)` }} />
              <div style={{ position:"absolute", inset:0, padding:"18px 20px", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                <div>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:"rgba(255,255,255,0.22)", backdropFilter:"blur(6px)", color:"#fff", fontSize:10, fontWeight:900, letterSpacing:1, padding:"4px 10px", borderRadius:20 }}>
                    <Tag size={10} /> {cat.name.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize:30, fontWeight:900, color:"#fff", lineHeight:1, textShadow:"0 2px 10px rgba(0,0,0,0.25)" }}>{offerLabel(o)}</p>
                  <p style={{ fontSize:13, fontWeight:800, color:"rgba(255,255,255,0.95)", marginTop:6 }}>{o.title || "Limited-time offer"}</p>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.9)", fontWeight:700 }}>at {s.name}</span>
                    <span style={{ background:"#fff", color:cat.color, fontSize:11, fontWeight:900, padding:"6px 12px", borderRadius:20, display:"inline-flex", alignItems:"center", gap:3 }}>
                      Book now <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {items.length > 1 && (
        <div style={{ display:"flex", justifyContent:"center", gap:5, marginTop:10 }}>
          {items.map((_, i) => (
            <span key={i} style={{ width:i===active?18:6, height:6, borderRadius:3, background:i===active?C.pri:"#D6DAE6", transition:"all 0.3s var(--ease)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal snap-scroll rail of compact store cards. Renders nothing
 *  when there's nothing to show, so a rail never leaves an empty
 *  heading behind. */
export function StoreRail({ title, icon: Icon, iconColor = C.pri, stores, offersMap, onSelect, onSeeAll }) {
  if (!stores?.length) return null;
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {Icon && <Icon size={16} color={iconColor} strokeWidth={2.2} />}
          <h2 style={{ fontSize:17, fontWeight:900, color:C.text }}>{title}</h2>
        </div>
        {onSeeAll && (
          <span onClick={onSeeAll} style={{ fontSize:12, color:C.pri, fontWeight:800, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:2 }}>
            See all <ChevronRight size={14} />
          </span>
        )}
      </div>
      <div className="rail">
        {stores.map(s => {
          const cat = getCat(s.category);
          const o = offersMap?.[s._id];
          const dist = formatDistance(s.distanceKm);
          return (
            <div key={s._id} onClick={() => onSelect?.(s)} className="pressable" style={{ width:158, cursor:"pointer" }}>
              <div style={{ height:116, borderRadius:16, backgroundImage:`url(${getStoreCover(s)})`, backgroundSize:"cover", backgroundPosition:"center", position:"relative", overflow:"hidden", boxShadow:"0 4px 14px rgba(0,0,0,0.10)" }}>
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 55%)" }} />
                {o && (
                  <span style={{ position:"absolute", left:8, bottom:8, background:"#fff", color:C.priDark, fontSize:10, fontWeight:900, padding:"3px 8px", borderRadius:6, boxShadow:"0 2px 6px rgba(0,0,0,0.15)" }}>
                    {offerLabel(o)}
                  </span>
                )}
                {!s.isOpen && (
                  <span style={{ position:"absolute", top:8, left:8, background:"rgba(0,0,0,0.6)", color:"#fff", fontSize:9, fontWeight:900, padding:"3px 7px", borderRadius:6, letterSpacing:0.5 }}>CLOSED</span>
                )}
              </div>
              <div style={{ padding:"9px 2px 0" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
                  <p style={{ fontSize:13.5, fontWeight:900, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.name}</p>
                  <RatingPill rating={s.rating} />
                </div>
                <p style={{ fontSize:11, color:C.muted, marginTop:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {cat.name}{dist ? ` · ${dist}` : s.area ? ` · ${s.area}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
