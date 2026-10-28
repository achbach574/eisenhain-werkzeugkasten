// Fließband in Szene 8: Stapel wandern Richtung Presse und werden dort zerquetscht.
import OBR, { buildImage } from "./vendor/obr-sdk.js?v=5";
import { ID } from "./core.js?v=5";
import { BELT, STACKS, stackKeyOf } from "./data.js?v=5";
import { findMap, applyTo } from "./layout.js?v=5";
import { getSpiel, changeSpiel } from "./state.js?v=5";
import { showOverlay } from "./show.js?v=5";

export const BAND_KEY = `${ID}/band`;
export const HAUFEN_KEY = `${ID}/haufen`;
const LAST = BELT.xs.length - 1;
const STEP = BELT.xs[1] - BELT.xs[0];
const PRESS_X = BELT.xs[LAST] + STEP;
const SAFE_Y = BELT.y + 0.2;
const asset = (p) => new URL(p, window.location.href).href;

async function stackItems() {
  return OBR.scene.items.getItems((i) => i.type === "IMAGE" && Boolean(stackKeyOf(i)));
}

/** Markiert Stapel-Tokens (Name beginnt mit 01 bis 05) für das Fließband. Gibt die Anzahl zurück. */
export async function tagStacks() {
  const items = await stackItems();
  const missing = items.filter((i) => !(i.metadata && i.metadata[BAND_KEY]));
  if (!missing.length) return items.length;
  let mb;
  try { ({ b: mb } = await findMap()); } catch { return items.length; }
  const feldOf = {};
  for (const i of missing) {
    const b = await OBR.scene.items.getItemBounds([i.id]);
    const x = (b.center.x - mb.min.x) / mb.width;
    let best = 0;
    BELT.xs.forEach((bx, k) => { if (Math.abs(bx - x) < Math.abs(BELT.xs[best] - x)) best = k; });
    feldOf[i.id] = best;
  }
  await OBR.scene.items.updateItems(missing.map((i) => i.id), (drafts) => {
    for (const d of drafts) d.metadata[BAND_KEY] = { feld: feldOf[d.id] };
  });
  return items.length;
}

async function place(moves) {
  // moves: [{ id, x, y, visible? }]
  if (!moves.length) return;
  const { b: mb } = await findMap();
  const sdpi = await OBR.scene.grid.getDpi();
  const by = Object.fromEntries(moves.map((m) => [m.id, m]));
  await OBR.scene.items.updateItems(moves.map((m) => m.id), (drafts) => {
    for (const d of drafts) {
      const m = by[d.id];
      applyTo(d, { x: m.x, y: m.y }, mb, sdpi);
      if (m.feld != null) d.metadata[BAND_KEY] = { feld: m.feld };
      if (m.visible != null) d.visible = m.visible;
    }
  });
}

/** Eine Runde ist vorbei: dir = +1 Richtung Presse, -1 rückwärts (Shaker der falschen Richtung). */
export async function moveBelt(dir = 1) {
  await tagStacks();
  const spiel = await getSpiel();
  if (spiel.hammer >= 3) return { msg: "Der Hammer ist gestoppt. Das Band steht.", crushed: [] };
  const items = (await stackItems()).filter((i) => spiel.stapel[stackKeyOf(i)] === "band");
  if (!items.length) return { msg: "Kein Stapel mehr auf dem Band.", crushed: [] };
  const moves = [], crushed = [];
  for (const i of items) {
    const feld = (i.metadata[BAND_KEY] || { feld: 0 }).feld + dir;
    if (feld > LAST) crushed.push(i);
    else moves.push({ id: i.id, x: BELT.xs[Math.max(0, feld)], y: BELT.y, feld: Math.max(0, feld) });
  }
  await place(moves);
  for (const i of crushed) await crush(i);
  const names = crushed.map((i) => STACKS[stackKeyOf(i)].name);
  return { msg: names.length ? `Zerquetscht: ${names.join(", ")}` : (dir > 0 ? "Das Band rückt ein Feld vor." : "Das Band rutscht ein Feld zurück."), crushed: names };
}

async function crush(item) {
  const key = stackKeyOf(item);
  await changeSpiel((s) => { s.stapel[key] = "verloren"; });
  await place([{ id: item.id, x: PRESS_X, y: BELT.y, visible: false, feld: LAST + 1 }]);
  // Haufen rosa Hanteln an der Presse
  const { b: mb } = await findMap();
  const sdpi = await OBR.scene.grid.getDpi();
  const n = (await OBR.scene.items.getItems((i) => Boolean(i.metadata && i.metadata[HAUFEN_KEY]))).length;
  const size = 512;
  const img = buildImage({ url: asset("assets/rosa_haufen.png"), width: size, height: size, mime: "image/png" },
    { dpi: size, offset: { x: size / 2, y: size / 2 } })
    .layer("PROP").name(`Rosa Hanteln (${STACKS[key].short})`)
    .metadata({ [HAUFEN_KEY]: { from: key } })
    .build();
  applyTo(img, { x: PRESS_X + 0.01 * (n % 3) - 0.01, y: BELT.y + 0.12 + 0.03 * n, h: 0.09 }, mb, sdpi);
  await OBR.scene.items.addItems([img]);
  await showOverlay({ kind: "crush", title: "DONG!", text: `${STACKS[key].name} sind jetzt rosa Kurzhanteln.`, image: item.image.url });
}

/** Stapel springt vom Band und gilt als gerettet. */
export async function saveStacks(ids) {
  const items = (await OBR.scene.items.getItems(ids)).filter((i) => stackKeyOf(i));
  if (!items.length) return;
  await changeSpiel((s) => { for (const i of items) s.stapel[stackKeyOf(i)] = "gerettet"; });
  const moves = items.map((i) => {
    const feld = Math.min(LAST, (i.metadata[BAND_KEY] || { feld: 0 }).feld);
    return { id: i.id, x: BELT.xs[feld], y: SAFE_Y, visible: true, feld };
  });
  await place(moves);
}

/** Stapel wieder hinten aufs Band legen (Zange!). Ohne ids: der zuletzt gerettete. */
export async function returnStacks(ids) {
  const spiel = await getSpiel();
  let items = ids ? await OBR.scene.items.getItems(ids) : await stackItems();
  items = items.filter((i) => stackKeyOf(i) && spiel.stapel[stackKeyOf(i)] === "gerettet");
  if (!ids) items = items.slice(-1);
  if (!items.length) return null;
  await changeSpiel((s) => { for (const i of items) s.stapel[stackKeyOf(i)] = "band"; });
  await place(items.map((i) => ({ id: i.id, x: BELT.xs[0], y: BELT.y, visible: true, feld: 0 })));
  return items.map((i) => STACKS[stackKeyOf(i)].name);
}

/** Hammer gestoppt: alles, was noch auf dem Band liegt, ist gerettet. */
export async function stopHammer() {
  const spiel = await getSpiel();
  const items = (await stackItems()).filter((i) => spiel.stapel[stackKeyOf(i)] === "band");
  if (items.length) await saveStacks(items.map((i) => i.id));
  await showOverlay({ kind: "event", title: "Der Hammer steht still", text: "Das Band läuft aus. Alle Stapel darauf sind gerettet." });
}

/** Szene 8 neu aufbauen: alle Stapel zurück auf ihre Startfelder, Haufen weg. */
export async function resetBelt() {
  const items = await stackItems();
  const order = ["05", "04", "03", "02", "01"]; // Stadtfest ganz hinten, Hilde ganz vorn
  await place(items.map((i) => {
    const feld = order.indexOf(stackKeyOf(i));
    return { id: i.id, x: BELT.xs[feld], y: BELT.y, visible: true, feld };
  }));
  const piles = await OBR.scene.items.getItems((i) => Boolean(i.metadata && i.metadata[HAUFEN_KEY]));
  if (piles.length) await OBR.scene.items.deleteItems(piles.map((i) => i.id));
  await changeSpiel((s) => { for (const k of Object.keys(s.stapel)) s.stapel[k] = "band"; s.hammer = 0; });
}
