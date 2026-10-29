import OBR from "./vendor/obr-sdk.js?v=6";
import { ID, WOUNDS_KEY } from "./core.js?v=6";
import { healWound } from "./actions.js?v=6";
import { changeHerz, HERZ_KEY, CD_KEY } from "./finale.js?v=6";
import { OV_CH, OV_MODAL } from "./show.js?v=6";
import { goblinFor, GOBLIN_KEY } from "./data.js?v=6";
import { BAND_KEY, tagStacks, saveStacks, returnStacks } from "./belt.js?v=6";
import { SPIEL_KEY, applyTags } from "./state.js?v=6";
import { SHAKE_KEY, drinkShake, removeShake } from "./shake.js?v=6";

const here = (p) => new URL(p, window.location.href).href;
const GM = (extra = []) => ({ roles: ["GM"], every: extra });

// ---------- Großanzeige für alle ----------
let ovTimer = null;
function openOverlay(data) {
  clearTimeout(ovTimer);
  const url = here(`overlay.html#${encodeURIComponent(JSON.stringify(data))}`);
  Promise.resolve(OBR.modal.close(OV_MODAL)).catch(() => {}).finally(() => {
    ovTimer = setTimeout(() => OBR.modal.open({
      id: OV_MODAL, url, fullScreen: true, hideBackdrop: true, hidePaper: true, disablePointerEvents: true,
    }), 60);
  });
}

// ---------- Automatik (nur Spielleitung) ----------
let busy = false, again = false, lastSpiel = "", lastTakt;
async function housekeeping() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    if (!(await OBR.scene.isReady())) return;
    // Goblins erkennen
    const chars = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE");
    const todo = chars.filter((c) => { const g = goblinFor(c); return g && (!c.metadata[GOBLIN_KEY] || c.metadata[GOBLIN_KEY].key !== g); });
    if (todo.length) {
      await OBR.scene.items.updateItems(todo.map((t) => t.id), (ds) => { for (const d of ds) d.metadata[GOBLIN_KEY] = { key: goblinFor(d) }; });
    }
    await tagStacks();
    // Spielstand oder Countdown geändert: Schildchen anwenden
    const meta = await OBR.room.getMetadata();
    const spiel = JSON.stringify(meta[SPIEL_KEY] || {});
    const [cd] = await OBR.scene.items.getItems((i) => Boolean(i.metadata && i.metadata[CD_KEY]));
    const takt = cd ? cd.metadata[CD_KEY].value : null;
    if (spiel !== lastSpiel || takt !== lastTakt) {
      lastSpiel = spiel; lastTakt = takt;
      await applyTags(takt);
    }
  } catch (e) {
    console.warn("Eisenhain:", e);
  } finally {
    busy = false;
    if (again) { again = false; setTimeout(housekeeping, 300); }
  }
}
let hkTimer = null;
const soon = () => { clearTimeout(hkTimer); hkTimer = setTimeout(housekeeping, 700); };

OBR.onReady(async () => {
  OBR.broadcast.onMessage(OV_CH, (ev) => {
    const d = ev.data || {};
    if (d.hide) { clearTimeout(ovTimer); OBR.modal.close(OV_MODAL); }
    else if (d.show) openOverlay(d.show);
  });

  const role = await OBR.player.getRole();
  if (role === "GM") {
    OBR.scene.onReadyChange((r) => { if (r) { lastSpiel = ""; lastTakt = undefined; soon(); } });
    OBR.scene.items.onChange(soon);
    OBR.room.onMetadataChange(soon);
    soon();
  }

  OBR.contextMenu.create({
    id: `${ID}/menue`,
    icons: [{ icon: here("icons/wunde.svg"), label: "Wunden",
      filter: { roles: ["GM"], max: 1, every: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "CHARACTER" }] } }],
    onClick(context, elementId) {
      const id = context.items[0].id;
      OBR.popover.open({ id: `${ID}/popover`, url: here(`wunden.html?id=${encodeURIComponent(id)}`), width: 400, height: 600, anchorElementId: elementId });
    },
  });

  OBR.contextMenu.create({
    id: `${ID}/heilen`,
    icons: [{ icon: here("icons/heilen.svg"), label: "Eine Wunde heilen",
      filter: GM([{ key: "layer", value: "CHARACTER" }, { key: ["metadata", WOUNDS_KEY], value: undefined, operator: "!=" }]) }],
    onClick(context) { healWound(context.items.map((i) => i.id)); },
  });

  OBR.contextMenu.create({
    id: `${ID}/goblin`,
    icons: [{ icon: here("icons/goblin.svg"), label: "Goblin-Aktionen",
      filter: { roles: ["GM"], max: 1, every: [{ key: ["metadata", GOBLIN_KEY], value: undefined, operator: "!=" }] } }],
    onClick(context, elementId) {
      const id = context.items[0].id;
      OBR.popover.open({ id: `${ID}/goblin-pop`, url: here(`goblin.html?id=${encodeURIComponent(id)}`), width: 380, height: 560, anchorElementId: elementId });
    },
  });

  OBR.contextMenu.create({
    id: `${ID}/shake`,
    icons: [{ icon: here("icons/shake.svg"), label: "Shake trinken (W6)",
      filter: { roles: ["GM"], max: 1, every: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "CHARACTER" }, { key: ["metadata", GOBLIN_KEY], value: undefined }] } }],
    onClick(context) { drinkShake(context.items[0].id); },
  });

  OBR.contextMenu.create({
    id: `${ID}/shake-weg`,
    icons: [{ icon: here("icons/shake-weg.svg"), label: "Shake-Effekt beenden",
      filter: GM([{ key: ["metadata", SHAKE_KEY], value: undefined, operator: "!=" }]) }],
    onClick(context) { removeShake(context.items.map((i) => i.id)); },
  });

  OBR.contextMenu.create({
    id: `${ID}/gerettet`,
    icons: [{ icon: here("icons/gerettet.svg"), label: "Stapel gerettet!",
      filter: GM([{ key: ["metadata", BAND_KEY], value: undefined, operator: "!=" }]) }],
    onClick(context) { saveStacks(context.items.map((i) => i.id)); },
  });

  OBR.contextMenu.create({
    id: `${ID}/aufsband`,
    icons: [{ icon: here("icons/band.svg"), label: "Zurück aufs Band",
      filter: GM([{ key: ["metadata", BAND_KEY], value: undefined, operator: "!=" }]) }],
    onClick(context) { returnStacks(context.items.map((i) => i.id)); },
  });

  OBR.contextMenu.create({
    id: `${ID}/zeigen`,
    icons: [{ icon: here("icons/zeigen.svg"), label: "Auf dem Fernseher zeigen",
      filter: GM([{ key: "type", value: "IMAGE" }, { key: "layer", value: "PROP" }, { key: ["metadata", BAND_KEY], value: undefined }]) }],
    async onClick(context, elementId) {
      const ids = await handoutPages(context.items);
      const start = ids.indexOf(context.items[0].id);
      OBR.popover.open({
        id: `${ID}/handout-pop`,
        url: here(`handout.html?ids=${encodeURIComponent(ids.join(","))}&i=${Math.max(0, start)}`),
        width: 360, height: 300, anchorElementId: elementId,
      });
    },
  });

  OBR.contextMenu.create({
    id: `${ID}/herz-plus`,
    icons: [{ icon: here("icons/herz.svg"), label: "Herzpunkt geben",
      filter: GM([{ key: "type", value: "IMAGE" }, { key: "layer", value: "CHARACTER" }, { key: ["metadata", GOBLIN_KEY], value: undefined }]) }],
    onClick(context) { changeHerz(context.items.map((i) => i.id), 1); },
  });

  OBR.contextMenu.create({
    id: `${ID}/herz-minus`,
    icons: [{ icon: here("icons/herz-minus.svg"), label: "Herzpunkt wegnehmen",
      filter: GM([{ key: "layer", value: "CHARACTER" }, { key: ["metadata", HERZ_KEY], value: undefined, operator: "!=" }]) }],
    onClick(context) { changeHerz(context.items.map((i) => i.id), -1); },
  });
});

/** Ein Handout aus mehreren Seiten: alle Tokens gleichen Namens mit Nummer am Ende (Tagebuch 1, Tagebuch 2 …). */
async function handoutPages(selected) {
  const strip = (n) => String(n || "").replace(/[\s_-]*\d+\s*$/, "").trim().toLowerCase();
  const num = (n) => { const m = /(\d+)\s*$/.exec(String(n || "")); return m ? Number(m[1]) : 0; };
  if (selected.length > 1) return [...selected].sort((a, b) => num(a.name) - num(b.name) || a.name.localeCompare(b.name)).map((i) => i.id);
  const one = selected[0];
  const base = strip(one.name);
  if (!/\d+\s*$/.test(one.name || "") || !base) return [one.id];
  const sibs = await OBR.scene.items.getItems((i) => i.type === "IMAGE" && i.layer === one.layer && strip(i.name) === base && /\d+\s*$/.test(i.name || ""));
  return sibs.sort((a, b) => num(a.name) - num(b.name)).map((i) => i.id);
}

