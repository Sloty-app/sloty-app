import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { C } from "../constants";

/* Floating AI-assistant launcher. A fixed corner button sat on top of
   whatever was under it (e.g. the last category tile) with no way to get
   it out of the way, so it can now be dragged anywhere. On release it
   snaps to the nearest left/right screen edge and the spot is remembered
   across visits. A move of under a few pixels is still a normal tap. */

const SIZE = 54, EDGE = 12, KEY = "sloty-fab-pos";
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const bounds = () => ({
  maxX: window.innerWidth - SIZE - EDGE,
  minY: EDGE + 8,
  maxY: window.innerHeight - SIZE - 100, // stay above the bottom nav
});

function initialPos() {
  const b = bounds();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved.side === "string" && typeof saved.y === "number") {
      return { x: saved.side === "left" ? EDGE : b.maxX, y: clamp(saved.y, b.minY, b.maxY) };
    }
  } catch { /* storage unavailable — use the default spot */ }
  return { x: b.maxX, y: b.maxY };
}

export default function AssistantFab({ onOpen }) {
  const [pos, setPos] = useState(initialPos);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);

  // Keep the button on screen when the window resizes or the phone rotates
  useEffect(() => {
    const onResize = () => setPos(p => {
      const b = bounds();
      return { x: p.x > window.innerWidth / 2 ? b.maxX : EDGE, y: clamp(p.y, b.minY, b.maxY) };
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true; setDragging(true);
    const b = bounds();
    setPos({ x: clamp(d.ox + dx, EDGE, b.maxX), y: clamp(d.oy + dy, b.minY, b.maxY) });
  };
  const onPointerUp = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (!d.moved) { onOpen(); return; }
    setDragging(false);
    const b = bounds();
    setPos(p => {
      const side = p.x + SIZE / 2 < window.innerWidth / 2 ? "left" : "right";
      try { localStorage.setItem(KEY, JSON.stringify({ side, y: p.y })); } catch { /* ignore */ }
      return { x: side === "left" ? EDGE : b.maxX, y: p.y };
    });
  };

  return (
    <button
      aria-label="Open Sloty Assistant (drag to move)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; setDragging(false); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{
        position: "fixed", left: pos.x, top: pos.y, width: SIZE, height: SIZE, borderRadius: "50%", zIndex: 90,
        background: `linear-gradient(100deg,${C.pri},#DB2777)`, border: "none",
        boxShadow: dragging ? `0 14px 32px ${C.pri}77` : `0 8px 24px ${C.pri}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: dragging ? "grabbing" : "grab", touchAction: "none", userSelect: "none",
        transform: dragging ? "scale(1.08)" : "none",
        transition: dragging ? "none" : "left 0.22s var(--ease), top 0.22s var(--ease), transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <Sparkles size={22} color="#fff" />
    </button>
  );
}
