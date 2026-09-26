import { C } from "../constants";

export function EmptyState({
  icon: Icon,
  iconColor = C.pri,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  badgeText,
  badgeColor = C.green,
  style = {},
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 26,
          background: `${iconColor}14`,
          border: `1.5px solid ${iconColor}28`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
          boxShadow: `0 10px 24px ${iconColor}1a`,
        }}
      >
        {Icon && <Icon size={34} color={iconColor} strokeWidth={2} />}
      </div>

      {badgeText && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: badgeColor,
            background: `${badgeColor}18`,
            padding: "4px 10px",
            borderRadius: 12,
            marginBottom: 10,
            letterSpacing: 0.3,
          }}
        >
          {badgeText}
        </span>
      )}

      <h3
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: C.text,
          marginBottom: 8,
          letterSpacing: -0.3,
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: 13,
            color: C.muted,
            maxWidth: 320,
            lineHeight: 1.5,
            marginBottom: actionLabel ? 20 : 0,
          }}
        >
          {description}
        </p>
      )}

      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            padding: "13px 28px",
            background: `linear-gradient(135deg, ${C.pri}, #DB2777)`,
            color: "#fff",
            border: "none",
            borderRadius: 16,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "'Nunito',sans-serif",
            boxShadow: `0 8px 24px ${C.pri}3a`,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            transition: "transform 0.15s ease",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {actionLabel}
        </button>
      )}

      {secondaryActionLabel && (
        <button
          onClick={onSecondaryAction}
          style={{
            marginTop: 10,
            padding: "10px 20px",
            background: "transparent",
            color: C.muted,
            border: "none",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "'Nunito',sans-serif",
          }}
        >
          {secondaryActionLabel}
        </button>
      )}
    </div>
  );
}
