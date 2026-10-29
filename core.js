// Reine Logik ohne Owlbear-Abhängigkeit (damit sie sich testen lässt).

export const ID = "eisenhain.werkzeugkasten";
export const WOUNDS_KEY = `${ID}/wunden`;
export const VISUAL_KEY = `${ID}/anzeige`;
export const SETTINGS_KEY = `${ID}/einstellungen`;
export const DEFAULT_SETTINGS = { maxWounds: 4 };
export const MAX_KEY = `${ID}/herzen`;

// Bosse halten mehr aus. Standard nach Name, im Wunden-Menü pro Token änderbar.
export const NAME_DEFAULTS = [
  { re: /karl/i, max: 12 },
  { re: /rita/i, max: 5 },
];
export function maxFor(item, globalMax) {
  const own = item && item.metadata && item.metadata[MAX_KEY];
  if (Number.isFinite(own)) return own;
  const n = ((item && item.name) || "") + " " + ((item && item.text && item.text.plainText) || "");
  const d = NAME_DEFAULTS.find((x) => x.re.test(n));
  return d ? d.max : globalMax;
}

// Wundenkatalog. Eigene Wunden lassen sich im Menü zusätzlich anlegen.
export const CATALOG = [
  { key: "arm", icon: "🦾", name: "Verlorener Arm", effect: "Keine Aktionen mit zwei Händen. Vielleicht taucht der Arm im Abfluss wieder auf." },
  { key: "kater", icon: "🔥", name: "Muskelkater des Grauens", effect: "Stärkeproben sind schwer, bis der Held sich ausgeruht hat." },
  { key: "kreide", icon: "👁️", name: "Kreideauge", effect: "Fernangriffe und Wahrnehmung sind schwer." },
  { key: "fuss", icon: "🦶", name: "Hantel auf dem Fuß", effect: "Der Held bewegt sich nur halb so weit." },
  { key: "ruecken", icon: "🦴", name: "Hexenschuss", effect: "Nichts Schweres heben, nicht bücken." },
  { key: "rosa", icon: "🎀", name: "Rosa Demütigung", effect: "Einschüchtern gelingt nicht mehr. Alle lachen." },
  { key: "takt", icon: "🥁", name: "Takt im Kopf", effect: "Zählt laut mit. Kann nicht schleichen oder still sein." },
  { key: "schleim", icon: "🧪", name: "Schleimfinger", effect: "Kann einen Gegenstand nicht mehr loslassen." },
  { key: "prellung", icon: "🩹", name: "Prellung", effect: "Keine Zusatzwirkung. Einfach nur aua." },
];

export function clampMax(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_SETTINGS.maxWounds;
  return Math.min(6, Math.max(2, v));
}

// Wie nah ist der Held am Tod? Abhängig von Wundenzahl und Grenze.
export function stageFor(count, max) {
  if (count <= 0) return { id: "fit", label: "Fit", ring: null, bg: "#2e7d32" };
  if (count >= max) return { id: "down", label: "Am Boden", ring: "#000000", bg: "#4a0000" };
  if (count === max - 1) return { id: "critical", label: "Kritisch", ring: "#e53935", bg: "#b71c1c" };
  if (count <= Math.floor((max - 1) / 2)) return { id: "hurt", label: "Angeschlagen", ring: "#f2c94c", bg: "#8d6e00" };
  return { id: "wounded", label: "Verwundet", ring: "#fb8c00", bg: "#bf5f00" };
}

export function hearts(count, max) {
  const left = Math.max(0, max - count);
  if (max > 6) return `♥ ${left}/${max}`;
  return "♥".repeat(left) + "♡".repeat(Math.min(count, max));
}

export function emptyState() {
  return { list: [] };
}

export function readState(metadata) {
  const s = metadata && metadata[WOUNDS_KEY];
  if (!s || !Array.isArray(s.list)) return emptyState();
  return JSON.parse(JSON.stringify(s));
}

export function labelText(state, max) {
  const c = state.list.length;
  const stage = stageFor(c, max);
  const head = `${hearts(c, max)}  ${stage.label.toUpperCase()}`;
  if (!c) return head;
  // Höchstens zwei Wunden pro Zeile, damit das Schild schmal bleibt
  const lines = [];
  for (let i = 0; i < state.list.length; i += 2) {
    lines.push(state.list.slice(i, i + 2).map((w) => w.name).join(" · "));
  }
  return head + "\n" + lines.join("\n");
}

let counter = 0;
export function makeWound(src) {
  counter += 1;
  return {
    uid: `${Date.now().toString(36)}-${counter}`,
    key: src.key || "eigene",
    icon: src.icon || "🩸",
    name: String(src.name || "Wunde").slice(0, 40),
    effect: String(src.effect || "").slice(0, 200),
  };
}

/**
 * Wendet Wundenzustand auf ein Token an (Bildtausch und Liegen).
 * token: einfaches Objekt oder Immer-Entwurf mit image, grid, rotation.
 * Gibt den bereinigten Zustand zurück, der in die Metadaten geschrieben wird.
 */
export function applyStateToToken(token, state, max) {
  const s = state;
  // Bildvariante: die zuletzt zugefügte Wunde mit Bild gewinnt.
  const active = [...s.list].reverse().find((w) => w.variant && w.variant.image);
  if (active && token.image) {
    if (!s.original) {
      s.original = { image: { ...token.image }, grid: { dpi: token.grid.dpi, offset: { ...token.grid.offset } } };
    }
    token.image = { ...active.variant.image };
    token.grid = { dpi: active.variant.grid.dpi, offset: { ...active.variant.grid.offset } };
  } else if (s.original && token.image) {
    token.image = { ...s.original.image };
    token.grid = { dpi: s.original.grid.dpi, offset: { ...s.original.grid.offset } };
    delete s.original;
  }
  // Am Boden: Token kippt um 90 Grad, beim Heilen zurück.
  const down = s.list.length >= max;
  if (down && s.prevRotation === undefined) {
    s.prevRotation = token.rotation;
    token.rotation = token.rotation + 90;
  } else if (!down && s.prevRotation !== undefined) {
    token.rotation = s.prevRotation;
    delete s.prevRotation;
  }
  return s;
}
