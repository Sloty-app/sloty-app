import { useState, memo } from "react";
import { Clock, Circle, Heart, Share2, MapPin } from "lucide-react";
import { C } from "../constants";
import { getStoreCover, getOpenLabel } from "../utils/storeMedia";
import { getCat } from "../constants";
import { RatingPill } from "./HomeSections";
import CategoryIllustration from "./CategoryArt";

// Self-contained pulse animation for the "Open" status dot — a small
// live/real-time feel without depending on a global CSS keyframe file.
const pulseStyle = `
@keyframes storeCardPulse {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(2.6); opacity: 0; }
}
.store-card__pulse-ring {
  position: absolute; inset: 0; border-radius: 50%;
  background: #fff; animation: storeCardPulse 1.6s ease-out infinite;
}
`;

const offerLabel = (o) =>
  o.discountType === "free" ? "FREE" : o.discountType === "percentage" ? `${o.discountValue}% OFF` : `₹${o.discountValue} OFF`;

/* Zomato-style card: photo with an offer tag riding its bottom edge,
   then a tight two-line header (name + green rating pill on one line,
   category · distance · hours on the next), service chips, and one
   clear primary action. The old card scattered the same facts across
   five separate rows with a big "from ₹" block competing with the
   name — this puts the eye on name → rating → where/when, in that
   order, which is the hierarchy every major listing app has settled on. */
function StoreCard({ store, onSelect, onBook, isFavorite, onToggleFavorite, onShare, distanceLabel, offer }) {
  const cat = getCat(store.category);
  const cover = getStoreCover(store);
  const [imgFailed, setImgFailed] = useState(false);
  const fromPrice = store.services?.find(s => !s.isPriceVariable && s.price)?.price;

  const handleBook = (e) => { e.stopPropagation(); if (store.isOpen && onBook) onBook(store); };
  const handleFavorite = (e) => { e.stopPropagation(); onToggleFavorite?.(store); };
  const handleShare = (e) => { e.stopPropagation(); onShare?.(store); };

  const iconBtn = {
    width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.94)", border: "none",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  };

  return (
    <div className="store-card fade-in" onClick={() => onSelect?.(store)}>
      <style>{pulseStyle}</style>
      <div
        className="store-card__cover"
        style={imgFailed ? { background: `linear-gradient(135deg,${cat.color}22,${cat.color}11)`, display:"flex", alignItems:"center", justifyContent:"center" } : { backgroundImage: `url(${cover})`, height: 160 }}
      >
        {imgFailed && (
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CategoryIllustration categoryId={store.category} size={48} />
          </div>
        )}
        {!imgFailed && <img src={cover} alt="" style={{ display: "none" }} onError={() => setImgFailed(true)} />}

        {/* Status — top-left */}
        <span className="store-card__status" style={{ background: store.isOpen ? C.green : "rgba(26,26,46,0.85)", left: 12, right: "auto" }}>
          {store.isOpen ? (
            <span style={{ position:"relative", width:7, height:7, display:"inline-flex" }}>
              <Circle size={7} color="#fff" fill="#fff" style={{ position:"relative", zIndex:1 }} />
              <span className="store-card__pulse-ring" />
            </span>
          ) : <Circle size={7} color="#fff" fill="#fff" />}
          {store.isOpen ? "Open now" : getOpenLabel(store) || "Closed"}
        </span>

        {/* Actions — top-right */}
        <div style={{ position: "absolute", top: 10, right: 12, display: "flex", gap: 6, zIndex: 2 }}>
          {onShare && <button aria-label="Share" onClick={handleShare} style={iconBtn}><Share2 size={14} color="#3A4256" /></button>}
          {onToggleFavorite && (
            <button aria-label="Favorite" onClick={handleFavorite} style={iconBtn}>
              <Heart size={15} color={isFavorite ? C.priDark : "#3A4256"} fill={isFavorite ? C.priDark : "none"} />
            </button>
          )}
        </div>

        {/* Offer tag — rides the bottom edge of the photo, Zomato-style */}
        {offer && (
          <div style={{ position: "absolute", bottom: 10, left: 12, zIndex: 2, background: "#fff", color: offer.discountType === "free" ? "#0F8F5A" : C.priDark, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 900, letterSpacing: 0.3, boxShadow: "0 3px 10px rgba(0,0,0,0.18)" }}>
            {offerLabel(offer)}{offer.title ? <span style={{ fontWeight: 700, color: C.muted }}> · {offer.title}</span> : null}
          </div>
        )}
      </div>

      <div className="store-card__body" style={{ padding: "12px 14px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
            {store.name}
          </h3>
          <RatingPill rating={store.rating} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ color: cat.color, fontWeight: 800 }}>{cat.name}</span>
          <span>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <MapPin size={11} />{distanceLabel || store.area || store.city}
          </span>
          <span>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Clock size={11} />{store.workingHours?.open}–{store.workingHours?.close}
          </span>
          {store.totalReviews > 0 && <span style={{ marginLeft: "auto", fontSize: 11 }}>{store.totalReviews} ratings</span>}
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "11px 0 12px", scrollbarWidth: "none" }}>
          {store.services?.slice(0, 3).map((s) => (
            <span key={s.name} style={{ flexShrink: 0, fontSize: 11, background: "#F3F4F9", color: "#3A4256", padding: "5px 11px", borderRadius: 20, fontWeight: 700 }}>
              {s.name}
            </span>
          ))}
          {(store.services?.length || 0) > 3 && (
            <span style={{ flexShrink: 0, fontSize: 11, color: C.muted, padding: "5px 6px", fontWeight: 700 }}>+{store.services.length - 3} more</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {fromPrice ? (
            <div style={{ flexShrink: 0 }}>
              <p style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.5 }}>FROM</p>
              <p style={{ fontSize: 17, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>₹{fromPrice}</p>
            </div>
          ) : null}
          <button
            onClick={handleBook}
            disabled={!store.isOpen}
            className="pressable"
            style={{
              flex: 1, padding: "12px",
              background: store.isOpen ? `linear-gradient(135deg,${C.pri},${C.priDark})` : "#E8ECF5",
              color: store.isOpen ? "#fff" : C.muted,
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800,
              cursor: store.isOpen ? "pointer" : "not-allowed",
              fontFamily: "'Nunito',sans-serif",
              boxShadow: store.isOpen ? `0 6px 18px ${C.pri}40` : "none",
            }}
          >
            {store.isOpen ? "Book a Slot" : "Currently Closed"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Store lists can be long, and re-render often (favoriting, search
// filtering, distance updates) — memoizing means a card only re-renders
// when its own props actually change, not every time a sibling does.
export default memo(StoreCard);
