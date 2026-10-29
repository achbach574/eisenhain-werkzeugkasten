// Geräusche für den Fernseher, erzeugt im Browser (keine Audiodateien nötig).
import { ac, clank } from "./dice.js?v=6";

function noise(c, at, dur, gain, filterType, freq, q = 1) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

function boom(c, at, gain, from, to, dur) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + dur * 0.6);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at); o.stop(at + dur + 0.05);
}

/** Der große Dong des Countdowns: tiefe Glocke mit langem Nachhall. */
export function playDong() {
  try {
    const c = ac();
    const t = c.currentTime + 0.02;
    boom(c, t, 0.9, 90, 45, 1.2);
    const partials = [[1, 0.6, 5.5], [2.01, 0.35, 4], [2.74, 0.25, 3.2], [3.96, 0.15, 2.4], [5.4, 0.1, 1.6]];
    for (const [m, gn, dur] of partials) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = 73 * m;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gn, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.1);
    }
    noise(c, t, 0.08, 0.5, "lowpass", 900);
  } catch (e) { /* ohne Ton weiter */ }
}

/** Stampfhammer: schwerer Schlag, knirschendes Metall, zischender Dampf. */
export function playStamp() {
  try {
    const c = ac();
    const t = c.currentTime + 0.02;
    noise(c, t, 0.25, 0.25, "highpass", 2500);           // Kette rasselt beim Fallen
    const hit = t + 0.28;
    boom(c, hit, 1.0, 120, 38, 0.9);                       // Aufprall
    noise(c, hit, 0.35, 0.9, "lowpass", 600);              // Wumms
    noise(c, hit + 0.02, 0.5, 0.45, "bandpass", 1800, 2);  // Metall knirscht
    clank(c, hit, 0.35, 210);
    clank(c, hit + 0.05, 0.2, 330);
    noise(c, hit + 0.35, 1.4, 0.18, "highpass", 4000);     // Dampf zischt
    // rosa Hanteln klimpern in die Kiste
    for (let i = 0; i < 7; i++) clank(c, hit + 0.6 + i * 0.09 + Math.random() * 0.04, 0.05, 1400 + Math.random() * 800);
  } catch (e) { /* ohne Ton weiter */ }
}
