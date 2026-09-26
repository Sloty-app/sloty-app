import { C } from "../constants";

export function ShimmerBox({ width = "100%", height = 16, radius = 8, style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, #F0F2F8 25%, #E2E6F0 50%, #F0F2F8 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        ...style,
      }}
    />
  );
}

export function StoreCardSkeleton() {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: "var(--radius-lg, 24px)",
        marginBottom: 16,
        overflow: "hidden",
        boxShadow: "var(--shadow-sm, 0 2px 12px rgba(0,0,0,0.06))",
      }}
    >
      {/* Cover image shimmer */}
      <ShimmerBox height={160} radius={0} />
      <div style={{ padding: 14 }}>
        {/* Title + Rating pill */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <ShimmerBox width="60%" height={18} radius={6} />
          <ShimmerBox width="46px" height={22} radius={20} />
        </div>
        {/* Category · Distance · Hours */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <ShimmerBox width="35%" height={12} radius={4} />
          <ShimmerBox width="25%" height={12} radius={4} />
        </div>
        {/* Service chips */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <ShimmerBox width="28%" height={24} radius={12} />
          <ShimmerBox width="32%" height={24} radius={12} />
          <ShimmerBox width="24%" height={24} radius={12} />
        </div>
        {/* CTA Button */}
        <ShimmerBox width="100%" height={44} radius={14} />
      </div>
    </div>
  );
}

export function StoreListSkeleton({ count = 3 }) {
  return (
    <div style={{ padding: "8px 0" }}>
      {Array.from({ length: count }, (_, i) => (
        <StoreCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function BookingCardSkeleton() {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: "var(--radius-lg, 24px)",
        padding: 16,
        marginBottom: 14,
        boxShadow: "var(--shadow-sm, 0 2px 12px rgba(0,0,0,0.06))",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <ShimmerBox width="50%" height={18} radius={6} />
        <ShimmerBox width="65px" height={22} radius={12} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        <ShimmerBox width="70%" height={12} radius={4} />
        <ShimmerBox width="45%" height={12} radius={4} />
        <ShimmerBox width="40%" height={12} radius={4} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #F0F2F8" }}>
        <ShimmerBox width="80px" height={28} radius={10} />
        <ShimmerBox width="60px" height={20} radius={6} />
      </div>
    </div>
  );
}

export function BookingListSkeleton({ count = 3 }) {
  return (
    <div style={{ padding: "8px 0" }}>
      {Array.from({ length: count }, (_, i) => (
        <BookingCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StoreDetailSkeleton() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 110 }}>
      {/* Hero cover shimmer */}
      <ShimmerBox height={220} radius={0} />
      <div style={{ padding: 16 }}>
        <div style={{ background: C.card, borderRadius: 24, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <ShimmerBox width="55%" height={22} radius={6} />
            <ShimmerBox width="48px" height={24} radius={20} />
          </div>
          <ShimmerBox width="70%" height={12} radius={4} style={{ marginBottom: 8 }} />
          <ShimmerBox width="40%" height={12} radius={4} />
        </div>
        {/* Tab pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <ShimmerBox width="80px" height={34} radius={14} />
          <ShimmerBox width="80px" height={34} radius={14} />
          <ShimmerBox width="80px" height={34} radius={14} />
        </div>
        {/* Services items */}
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: C.card, borderRadius: 16, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ width: "60%" }}>
              <ShimmerBox width="80%" height={14} radius={4} style={{ marginBottom: 6 }} />
              <ShimmerBox width="40%" height={10} radius={4} />
            </div>
            <ShimmerBox width="60px" height={30} radius={10} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwnerDashboardSkeleton() {
  return (
    <div style={{ padding: 16 }}>
      {/* 4 Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ background: C.card, borderRadius: 18, padding: 16 }}>
            <ShimmerBox width={36} height={36} radius={12} style={{ marginBottom: 10 }} />
            <ShimmerBox width="50%" height={22} radius={6} style={{ marginBottom: 6 }} />
            <ShimmerBox width="65%" height={12} radius={4} />
          </div>
        ))}
      </div>
      {/* Live queue header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <ShimmerBox width="40%" height={18} radius={6} />
        <ShimmerBox width="20%" height={18} radius={6} />
      </div>
      {/* Queue items */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: C.card, borderRadius: 18, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <ShimmerBox width="45%" height={16} radius={6} />
            <ShimmerBox width="60px" height={22} radius={10} />
          </div>
          <ShimmerBox width="70%" height={12} radius={4} style={{ marginBottom: 6 }} />
          <ShimmerBox width="50%" height={12} radius={4} />
        </div>
      ))}
    </div>
  );
}
