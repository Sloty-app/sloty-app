import { useState } from "react";
import { MapPin, Clock, IndianRupee, Circle, Star, Heart, Share2, Tag } from "lucide-react";
import { C } from "../constants";
import { getStoreCover, formatRating, getOpenLabel } from "../utils/storeMedia";
import { getCat } from "../constants";
import { StarRating } from "./UI";
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
/* Subtle lift on hover (desktop) and tap (mobile) — gives cards a
   tactile, responsive feel instead of sitting completely static. */
.store-card {
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.store-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 28px rgba(0,0,0,0.10);
}
.store-card:active {
  transform: translateY(-1px) scale(0.99);
}
`;

export default function StoreCard({ store, onSelect, onBook, isFavorite, onToggleFavorite, onShare, distanceLabel, offer }) {
  const cat = getCat(store.category);
  const cover = getStoreCover(store);
  const [imgFailed, setImgFailed] = useState(false);

  const handleBook = (e) => {
    e.stopPropagation();
    if (store.isOpen && onBook) onBook(store);
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    onToggleFavorite?.(store);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    onShare?.(store);
  };

  return (
    <div className="store-card fade-in" onClick={() => onSelect?.(store)}>
      <style>{pulseStyle}</style>
      <div
        className="store-card__cover"
        style={imgFailed ? { background: `linear-gradient(135deg,${cat.color}22,${cat.color}11)`, display:"flex", alignItems:"center", justifyContent:"center" } : { backgroundImage: `url(${cover})` }}
      >
        {imgFailed && (
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CategoryIllustration categoryId={store.category} size={48} />
          </div>
        )}
        {/* Hidden img tag purely to detect load failures so we can fall back above */}
        {!imgFailed && (
          <img src={cover} alt="" style={{ display: "none" }} onError={() => setImgFailed(true)} />
        )}
        <span className="store-card__badge" style={{ color: cat.color }}>
          {cat.name}
        </span>
        {onToggleFavorite && (
          <button
            onClick={handleFavorite}
            style={{
              position: "absolute", top: 10, right: 12, width: 30, height: 30,
              borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 2,
            }}
          >
            <Heart size={15} color={isFavorite ? C.pri : "#A0A8B8"} fill={isFavorite ? C.pri : "none"} />
          </button>
        )}
        {onShare && (
          <button
            onClick={handleShare}
            style={{
              position: "absolute", top: 10, right: onToggleFavorite ? 50 : 12, width: 30, height: 30,
              borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 2,
            }}
          >
            <Share2 size={14} color="#A0A8B8" />
          </button>
        )}
        <span
          className="store-card__status"
          style={{ background: store.isOpen ? C.green : C.red, top: onToggleFavorite ? 48 : 10 }}
        >
          {store.isOpen ? (
            <span style={{ position:"relative", width:7, height:7, display:"inline-flex" }}>
              <Circle size={7} color="#fff" fill="#fff" style={{ position:"relative", zIndex:1 }} />
              <span className="store-card__pulse-ring" />
            </span>
          ) : (
            <Circle size={7} color="#fff" fill="#fff" />
          )}
          {store.isOpen ? "Open" : "Closed"}
        </span>
        {offer && (
          <div style={{
            position: "absolute", bottom: 10, left: 10, zIndex: 2,
            background: offer.discountType === "free" ? "linear-gradient(100deg,#00C9A7,#00A88C)" : "linear-gradient(100deg,#F97316,#EA580C)",
            borderRadius: 10, padding: "5px 10px",
            display: "flex", alignItems: "center", gap: 4,
            boxShadow: offer.discountType === "free" ? "0 3px 10px rgba(0,168,140,0.4)" : "0 3px 10px rgba(234,88,12,0.4)",
          }}>
            <Tag size={11} color="#fff" />
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>
              {offer.discountType === "free" ? "FREE" : offer.discountType === "percentage" ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`}
            </span>
          </div>
        )}
        {!store.isOpen && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            paddingBottom: 12, zIndex: 1,
          }}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {getOpenLabel(store)}
            </span>
          </div>
        )}
      </div>

      <div className="store-card__body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {store.name}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className="rating-stars" style={{ display:"flex", alignItems:"center", gap:1 }}>
                <StarRating rating={store.rating} size={11} />
                <span style={{ fontSize: 12, fontWeight: 800, color: C.text, marginLeft: 4 }}>
                  {formatRating(store.rating)}
                </span>
                {store.totalReviews > 0 && (
                  <span style={{ fontSize: 11, color: C.muted }}>({store.totalReviews})</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <MapPin size={11} color={C.muted} />
                <span style={{ fontSize: 11, color: C.muted }}>{store.area || store.city}</span>
                {distanceLabel && <span style={{ fontSize: 11, color: C.pri, fontWeight: 700, marginLeft: 4 }}>· {distanceLabel}</span>}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
            <p style={{ fontSize: 10, color: C.muted }}>from</p>
            <div style={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end" }}>
              <IndianRupee size={13} color={C.pri} strokeWidth={2.5} />
              <p style={{ fontSize: 17, fontWeight: 900, color: C.pri }}>
                {store.services?.[0]?.price || 0}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, scrollbarWidth: "none" }}>
          {store.services?.slice(0, 3).map((s) => (
            <span
              key={s.name}
              style={{
                flexShrink: 0, fontSize: 11, background: cat.color + "15",
                color: cat.color, padding: "4px 12px", borderRadius: 20, fontWeight: 700,
              }}
            >
              {s.name}
            </span>
          ))}
          {(store.services?.length || 0) > 3 && (
            <span style={{ fontSize: 11, color: C.muted, padding: "4px 8px" }}>
              +{store.services.length - 3} more
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <Clock size={12} color={C.muted} />
          <span style={{ fontSize: 11, color: C.muted }}>
            {store.workingHours?.open} – {store.workingHours?.close}
          </span>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" }}>
            <cat.Icon size={14} color={cat.color} />
          </div>
        </div>

        <button
          onClick={handleBook}
          disabled={!store.isOpen}
          style={{
            width: "100%", padding: "13px",
            background: store.isOpen ? `linear-gradient(135deg,${C.pri},#C0304A)` : "#E8ECF5",
            color: store.isOpen ? "#fff" : C.muted,
            border: "none", borderRadius: 14, fontSize: 14, fontWeight: 800,
            cursor: store.isOpen ? "pointer" : "not-allowed",
            fontFamily: "'Nunito',sans-serif",
            boxShadow: store.isOpen ? "0 6px 20px rgba(255,94,125,0.3)" : "none",
          }}
        >
          {store.isOpen ? "Book a Slot" : "Currently Closed"}
        </button>
      </div>
    </div>
  );
}