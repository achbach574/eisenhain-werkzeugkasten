// Epilog: Die volle Gym-Karte liegt bereit und ersetzt im richtigen Moment die leere.
import OBR from "./vendor/obr-sdk.js?v=7";
import { showOverlay } from "./show.js?v=7";

const isFull = (i) => /voll/i.test(i.name || "");

async function maps() {
  const all = await OBR.scene.items.getItems((i) => i.layer === "MAP" && i.type === "IMAGE");
  if (all.length < 2) throw new Error("In dieser Szene braucht es zwei Karten: das leere und das volle Gym.");
  let full = all.find(isFull);
  // Ohne „voll“ im Namen gilt die oberste Karte als die volle (sie wurde zuletzt hineingezogen).
  if (!full) full = [...all].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))[0];
  let empty = null, area = -1, eb = null;
  for (const m of all.filter((i) => i.id !== full.id)) {
    const b = await OBR.scene.items.getItemBounds([m.id]);
    if (b.width * b.height > area) { area = b.width * b.height; empty = m; eb = b; }
  }
  return { full, empty, eb };
}

/** Volle Karte unsichtbar weit neben die leere legen. */
export async function prepareGym() {
  const { full, eb } = await maps();
  await OBR.scene.items.updateItems([full.id], (ds) => {
    for (const d of ds) {
      d.visible = false;
      d.position = { x: eb.min.x - eb.width * 40, y: eb.min.y - eb.height * 40 };
    }
  });
}

/** Volle Karte exakt über die leere legen und groß ankündigen. */
export async function revealGym() {
  const { full, empty, eb } = await maps();
  const sdpi = await OBR.scene.grid.getDpi();
  await OBR.scene.items.updateItems([full.id], (ds) => {
    for (const d of ds) {
      const baseW = (d.image.width / d.grid.dpi) * sdpi;
      const baseH = (d.image.height / d.grid.dpi) * sdpi;
      const s = Math.min(eb.width / baseW, eb.height / baseH);
      d.scale = { x: s, y: s };
      const k = (sdpi / d.grid.dpi) * s;
      const cx = eb.center.x, cy = eb.center.y;
      d.position = { x: cx + (d.grid.offset.x - d.image.width / 2) * k, y: cy + (d.grid.offset.y - d.image.height / 2) * k };
      d.zIndex = (empty.zIndex || 0) + 1;
      d.visible = true;
    }
  });
  await showOverlay({ kind: "glory", title: "Das Eisenhain Gym ist wieder stark", text: "Die Herzscheibe liegt im Schrein. Und im Gym wird wieder Eisen bewegt." });
}
