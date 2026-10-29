// Würfel des Eisenhain: Wurf, Bewertung und Eisenklang.
import { rollD } from "./shake.js?v=6";

export const DCS = { 0: "ohne Schwierigkeit", 8: "Leicht (8)", 12: "Normal (12)", 16: "Schwer (16)", 20: "Heldentat (20)" };

/**
 * mode: "normal" | "vorteil" | "nachteil"; sides: 4, 6, 8, 10, 12, 20, 100
 * Gibt ein Ergebnisobjekt für das Overlay zurück.
 */
export function makeRoll({ sides = 20, mode = "normal", count = 1, mod = 0, dc = 0, who = null }) {
  let rolls, kept;
  if (sides === 20 && mode !== "normal") {
    rolls = [rollD(20), rollD(20)];
    kept = mode === "vorteil" ? Math.max(...rolls) : Math.min(...rolls);
    count = 1;
  } else {
    rolls = Array.from({ length: Math.max(1, Math.min(6, count)) }, () => rollD(sides));
    kept = rolls.reduce((a, b) => a + b, 0);
  }
  const total = kept + mod;
  let crit = null;
  if (sides === 20 && count === 1) {
    if (kept === 20) crit = "pump";
    if (kept === 1) crit = "kater";
  }
  let verdict = null;
  if (dc) {
    if (crit === "pump") verdict = "erfolg";
    else if (crit === "kater") verdict = "fehlschlag";
    else verdict = total >= dc ? "erfolg" : "fehlschlag";
  }
  return { kind: "dice", sides, mode, count, rolls, kept, mod, total, dc, crit, verdict, who, t: Date.now() };
}

let ctx = null;
export function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function clank(c, at, gain = 0.5, base = 180) {
  // Inharmonische Teiltöne wie bei einer angeschlagenen Hantelscheibe
  const partials = [1, 2.76, 5.4, 8.93, 13.3];
  const out = c.createGain();
  out.gain.setValueAtTime(gain, at);
  out.gain.exponentialRampToValueAtTime(0.0008, at + 1.6);
  out.connect(c.destination);
  partials.forEach((p, k) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = base * p * (1 + (Math.random() - 0.5) * 0.01);
    g.gain.setValueAtTime(0.5 / (k + 1), at);
    g.gain.exponentialRampToValueAtTime(0.0005, at + 1.4 / (k * 0.7 + 1));
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 1.7);
  });
  // kurzer Anschlag
  const len = Math.floor(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const nz = c.createBufferSource();
  const ng = c.createGain();
  ng.gain.value = gain * 0.8;
  nz.buffer = buf;
  nz.connect(ng).connect(c.destination);
  nz.start(at);
}

/** Klappern während des Rollens, dann ein schwerer Schlag. Bei 20 ein Gong, bei 1 ein dumpfes Plopp. */
export function playRoll(crit) {
  try {
    const c = ac();
    const t = c.currentTime;
    for (let i = 0; i < 9; i++) clank(c, t + i * 0.12 + Math.random() * 0.03, 0.08, 900 + Math.random() * 500);
    const end = t + 1.25;
    if (crit === "pump") { clank(c, end, 0.6, 98); clank(c, end + 0.18, 0.5, 147); clank(c, end + 0.36, 0.55, 196); }
    else if (crit === "kater") { clank(c, end, 0.5, 70); }
    else clank(c, end, 0.45, 160);
  } catch (e) { /* ohne Ton weiter */ }
}
