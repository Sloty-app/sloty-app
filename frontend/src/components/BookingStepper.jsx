import { Check } from "lucide-react";
import { C } from "../constants";

const DEFAULT_STEPS = ["Service", "Date", "Time"];

export default function BookingStepper({ current = 0, steps = DEFAULT_STEPS }) {
  return (
    <div className="booking-stepper">
      {steps.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div className="booking-stepper__step">
            <div
              className="booking-stepper__dot"
              style={{
                background: i < current ? C.green : i === current ? `linear-gradient(100deg,${C.pri},#DB2777)` : "#E8ECF5",
                color: i <= current ? "#fff" : C.muted,
                boxShadow: i === current ? "0 4px 14px rgba(255,94,125,0.4)" : "none",
              }}
            >
              {i < current ? <Check size={16} strokeWidth={3} /> : i + 1}
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: i === current ? C.pri : C.muted }}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="booking-stepper__line"
              style={{ background: i < current ? C.green : "#E8ECF5" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}