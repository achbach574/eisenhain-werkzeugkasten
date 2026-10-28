// Szenen-Baukasten: Tokens per Befehl relativ zur Karte platzieren.
// Koordinaten: x/y = Mittelpunkt als Anteil der Karte (0 bis 1), h = Höhe als Anteil der Kartenhöhe, w = Breite als Anteil der Kartenbreite.
import OBR, { buildImage } from "./vendor/obr-sdk.js?v=3";

const LAYERS = ["PROP", "MOUNT", "CHARACTER", "NOTE"];
const nameOf = (i) => (i.name || "").trim();
const labelOf = (i) => ((i.text && i.text.plainText) || "").trim();
const r3 = (n) => Math.round(n * 1000) / 1000;

export async function findMap() {
  const maps = await OBR.scene.items.getItems((i) => i.layer === "MAP" && i.type === "IMAGE");
  if (!maps.length) throw new Error("In dieser Szene liegt keine Karte auf der Ebene „Map“.");
  let best = null, bb = null, area = -1;
  for (const m of maps) {
    const b = await OBR.scene.items.getItemBounds([m.id]);
    if (b.width * b.height > area) { area = b.width * b.height; best = m; bb = b; }
  }
  return { map: best, b: bb };
}

export async function readScene() {
  const { b } = await findMap();
  const items = await OBR.scene.items.getItems((i) => i.type === "IMAGE" && LAYERS.includes(i.layer));
  const out = [];
  for (const i of items) {
    const ib = await OBR.scene.items.getItemBounds([i.id]);
    out.push({
      name: nameOf(i),
      label: labelOf(i) || undefined,
      layer: i.layer,
      x: r3((ib.center.x - b.min.x) / b.width),
      y: r3((ib.center.y - b.min.y) / b.height),
      h: r3(ib.height / b.height),
    });
  }
  out.sort((a, b2) => a.name.localeCompare(b2.name));
  return out;
}

function matches(item, query) {
  const q = String(query).trim().toLowerCase();
  if (q.endsWith("*")) {
    const p = q.slice(0, -1);
    return nameOf(item).toLowerCase().startsWith(p) || labelOf(item).toLowerCase().startsWith(p);
  }
  return nameOf(item).toLowerCase() === q || labelOf(item).toLowerCase() === q;
}

/** Wendet Größe, Lage und Eigenschaften auf ein Item (oder einen Immer-Entwurf) an. */
function applyTo(d, c, mb, sdpi) {
  const baseH = (d.image.height / d.grid.dpi) * sdpi;
  const baseW = (d.image.width / d.grid.dpi) * sdpi;
  let s = null;
  if (c.h != null) s = (c.h * mb.height) / baseH;
  else if (c.w != null) s = (c.w * mb.width) / baseW;
  if (s != null) {
    const flip = d.scale && d.scale.x < 0 ? -1 : 1;
    d.scale = { x: s * flip, y: s };
  }
  if (c.x != null && c.y != null) {
    const kx = (sdpi / d.grid.dpi) * d.scale.x;
    const ky = (sdpi / d.grid.dpi) * d.scale.y;
    const cx = mb.min.x + c.x * mb.width;
    const cy = mb.min.y + c.y * mb.height;
    d.position = {
      x: cx + (d.grid.offset.x - d.image.width / 2) * kx,
      y: cy + (d.grid.offset.y - d.image.height / 2) * ky,
    };
  }
  if (c.rotation != null) d.rotation = Number(c.rotation);
  if (c.visible != null) d.visible = Boolean(c.visible);
  if (c.locked != null) d.locked = Boolean(c.locked);
  if (c.layer) d.layer = c.layer;
  if (c.rename) d.name = String(c.rename);
  if (c.label != null && d.text) {
    d.text.plainText = String(c.label);
    d.textItemType = "LABEL";
  }
}

function loadSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Bild nicht ladbar: " + url));
    img.src = url;
  });
}

/** Führt eine Liste von Befehlen aus und gibt ein Protokoll zurück. */
export async function runCommands(cmds) {
  if (!Array.isArray(cmds)) cmds = [cmds];
  const { b: mb } = await findMap();
  const sdpi = await OBR.scene.grid.getDpi();
  const log = [];
  for (const c of cmds) {
    try {
      if (c.add) {
        const url = new URL(c.add, window.location.href).href;
        const { w, h } = await loadSize(url);
        const mime = url.toLowerCase().endsWith(".jpg") || url.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png";
        const item = buildImage({ url, width: w, height: h, mime }, { dpi: Math.max(w, h), offset: { x: w / 2, y: h / 2 } })
          .layer(c.layer || "PROP")
          .name(c.name || "Neues Token")
          .build();
        applyTo(item, { x: 0.5, y: 0.5, h: 0.1, ...c }, mb, sdpi);
        await OBR.scene.items.addItems([item]);
        log.push(`+ ${item.name} angelegt`);
        continue;
      }
      const all = await OBR.scene.items.getItems((i) => i.type === "IMAGE" && LAYERS.includes(i.layer) && matches(i, c.name));
      if (!all.length) { log.push(`? ${c.name}: nicht gefunden`); continue; }
      const targets = c.all ? all : [all[c.n || 0] || all[0]];
      const ids = targets.map((t) => t.id);
      if (c.delete) {
        await OBR.scene.items.deleteItems(ids);
        log.push(`- ${c.name}: gelöscht (${ids.length})`);
        continue;
      }
      await OBR.scene.items.updateItems(ids, (drafts) => { for (const d of drafts) applyTo(d, c, mb, sdpi); });
      log.push(`✓ ${c.name}${ids.length > 1 ? ` (${ids.length})` : ""}`);
    } catch (e) {
      log.push(`! ${c.name || c.add}: ${e.message || e}`);
    }
  }
  return log;
}
