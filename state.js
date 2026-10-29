// Spielstand: Was die Helden bisher geschafft haben, und was daraus folgt.
import OBR from "./vendor/obr-sdk.js?v=6";
import { ID } from "./core.js?v=6";
import { STACKS } from "./data.js?v=6";

export const SPIEL_KEY = `${ID}/spielstand`;

export const DEFAULT_SPIEL = {
  halle: true,          // Szene 7: Halle befreit (sonst durchgerannt)
  rita: "offen",        // offen | umgedreht | geflohen
  hammer: 0,            // Schritte gegen den Stampfhammer, 0 bis 3
  stuerze: 0,           // Stürze ins Netz in Szene 10
  stapel: { "01": "band", "02": "band", "03": "band", "04": "band", "05": "band" },
};

export async function getSpiel() {
  const meta = await OBR.room.getMetadata();
  const s = meta[SPIEL_KEY] || {};
  return { ...DEFAULT_SPIEL, ...s, stapel: { ...DEFAULT_SPIEL.stapel, ...(s.stapel || {}) } };
}

/** Ändert den Spielstand über eine Funktion, die den Entwurf bearbeitet. */
export async function changeSpiel(fn) {
  const s = await getSpiel();
  fn(s);
  s.hammer = Math.max(0, Math.min(3, s.hammer));
  s.stuerze = Math.max(0, Math.min(5, s.stuerze));
  await OBR.room.setMetadata({ [SPIEL_KEY]: s });
  return s;
}

export async function resetSpiel() {
  await OBR.room.setMetadata({ [SPIEL_KEY]: JSON.parse(JSON.stringify(DEFAULT_SPIEL)) });
}

export function countSaved(s) {
  return Object.values(s.stapel).filter((v) => v === "gerettet").length;
}

export function countdownStart(s) {
  return Math.max(0, (s.halle ? 8 : 6) - Math.min(2, s.stuerze));
}

/** Folgen für spätere Szenen, abgeleitet aus dem Spielstand. */
export function folgen(s) {
  const n = countSaved(s);
  const lost = Object.entries(s.stapel).filter(([, v]) => v === "verloren").map(([k]) => STACKS[k].name);
  const out = [];
  out.push(`<b>Countdown im Finale startet bei ${countdownStart(s)}</b> (${s.halle ? "Halle befreit: 8" : "durchgerannt: 6"}${s.stuerze ? `, ${Math.min(2, s.stuerze)} Sturz/Stürze` : ""}).`);
  if (n === 5) out.push("<b>5 Stapel gerettet:</b> Das Gym bekommt alles zurück. Szene 12 wird schwer, aber herrlich.");
  else if (n >= 3) out.push(`<b>${n} Stapel gerettet:</b> Im Epilog stehen ein paar rosa Hanteln im Gym, die keiner benutzen will.`);
  else out.push(`<b>Nur ${n} Stapel gerettet:</b> Im Finale kommt ein vierter Schritt dazu. Die eingebauten Scheiben müssen aus dem Wiederholer gerissen werden.`);
  if (lost.length) out.push(`Eingeschmolzen: ${lost.join(", ")}.`);
  if (s.rita === "umgedreht") out.push("<b>Rita ist umgedreht:</b> Sie bringt in Szene 12 das vierte Rad und bleibt im Epilog als Trainerin.");
  if (s.rita === "geflohen") out.push("<b>Rita ist geflohen:</b> Sie warnt Karl. Er bekommt im Finale einmal „Tempo!“.");
  if (s.hammer >= 3) out.push("<b>Hammer gestoppt:</b> Das Band läuft aus, alle Stapel auf dem Band sind gerettet.");
  return out;
}

/** Bedingungen, die in Token-Namen als [wenn …] stehen können. */
export function flags(s, takt) {
  const n = countSaved(s);
  const f = new Set();
  if (s.halle) f.add("halle"); else f.add("durchgerannt");
  if (s.rita === "umgedreht") f.add("rita");
  if (s.rita === "geflohen") f.add("geflohen");
  if (s.hammer >= 3) f.add("hammer");
  if (n === 5) f.add("alle");
  if (n >= 3 && n <= 4) f.add("einige");
  if (n <= 2) f.add("wenige");
  for (const [k, v] of Object.entries(s.stapel)) {
    if (v === "gerettet") { f.add(k); f.add(STACKS[k].short.toLowerCase()); }
    if (v === "verloren") f.add(`${k}-verloren`);
  }
  if (takt != null) f.add(`takt${takt}`);
  return f;
}

const TAG_RE = /\[(wenn|ab takt)\s+([^\]]+)\]/gi;

/** Sichtbarkeit laut Namens-Schildchen, oder null, wenn das Token keine hat. */
export function visibilityFor(name, f, takt) {
  let any = false, ok = true;
  for (const m of String(name || "").matchAll(TAG_RE)) {
    any = true;
    const kind = m[1].toLowerCase();
    const arg = m[2].trim().toLowerCase();
    if (kind === "ab takt") {
      ok = ok && takt != null && takt <= Number(arg);
    } else {
      for (const part of arg.split(/\s*(?:,|\+|und)\s*/)) {
        if (!part) continue;
        const neg = part.startsWith("!") || part.startsWith("nicht ");
        const key = part.replace(/^!|^nicht /, "").trim();
        ok = ok && (neg ? !f.has(key) : f.has(key));
      }
    }
  }
  return any ? ok : null;
}

/** Blendet alle markierten Tokens der Szene passend zum Spielstand ein oder aus. */
export async function applyTags(takt) {
  if (!(await OBR.scene.isReady())) return 0;
  const s = await getSpiel();
  const f = flags(s, takt);
  const items = await OBR.scene.items.getItems((i) => /\[(wenn|ab takt)\s/i.test(i.name || ""));
  const change = items.filter((i) => {
    const v = visibilityFor(i.name, f, takt);
    return v !== null && v !== i.visible;
  });
  if (!change.length) return 0;
  await OBR.scene.items.updateItems(change.map((i) => i.id), (drafts) => {
    for (const d of drafts) d.visible = visibilityFor(d.name, f, takt);
  });
  return change.length;
}
