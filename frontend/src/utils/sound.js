// utils/sound.js — a small, original two-tone chime synthesized with
// the Web Audio API, used as Sloty's own notification sound while the
// app is open (foreground). This only works while the tab is open —
// background OS push notifications always use the phone's default
// sound; no website can override that.
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function tone(audioCtx, freq, startTime, duration, peakGain = 0.28) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/** A bright two-note "ding-ding" — Sloty's own sound signature */
export function playChime() {
  try {
    const audioCtx = getCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    tone(audioCtx, 880, now, 0.18);        // A5
    tone(audioCtx, 1318.5, now + 0.12, 0.22); // E6 — a touch brighter, slightly overlapping
  } catch (e) { console.error("Sloty chime failed:", e); }
}

/** A softer single tone for less urgent updates (e.g. queue moved up) */
export function playSoftPing() {
  try {
    const audioCtx = getCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    tone(audioCtx, 660, audioCtx.currentTime, 0.16, 0.18);
  } catch (e) { console.error("Sloty ping failed:", e); }
}