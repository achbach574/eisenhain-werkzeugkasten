import OBR, { buildShape, buildLabel } from "./vendor/obr-sdk.js?v=3";
import {
  WOUNDS_KEY, VISUAL_KEY, SETTINGS_KEY, DEFAULT_SETTINGS,
  clampMax, stageFor, readState, labelText, makeWound, applyStateToToken,
} from "./core.js?v=3";

export async function getSettings() {
  const meta = await OBR.room.getMetadata();
  const s = { ...DEFAULT_SETTINGS, ...(meta[SETTINGS_KEY] || {}) };
  s.maxWounds = clampMax(s.maxWounds);
  return s;
}

export async function setSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  next.maxWounds = clampMax(next.maxWounds);
  await OBR.room.setMetadata({ [SETTINGS_KEY]: next });
  return next;
}

/** Ändert die Wunden der angegebenen Tokens und zeichnet die Anzeige neu. */
export async function mutateWounds(tokenIds, mutate) {
  if (!tokenIds.length) return;
  const { maxWounds } = await getSettings();
  await OBR.scene.items.updateItems(tokenIds, (drafts) => {
    for (const draft of drafts) {
      const state = readState(draft.metadata);
      mutate(state, draft);
      const clean = applyStateToToken(draft, state, maxWounds);
      if (clean.list.length === 0 && !clean.original && clean.prevRotation === undefined) {
        delete draft.metadata[WOUNDS_KEY];
      } else {
        draft.metadata[WOUNDS_KEY] = clean;
      }
    }
  });
  await renderVisuals(tokenIds);
}

export const addWound = (ids, source) =>
  mutateWounds(ids, (state) => state.list.push(makeWound(source)));

export const healWound = (ids, uid) =>
  mutateWounds(ids, (state) => {
    if (uid) state.list = state.list.filter((w) => w.uid !== uid);
    else state.list.pop();
  });

export const healAll = (ids) => mutateWounds(ids, (state) => { state.list = []; });

export const setVariant = (id, uid, download) =>
  mutateWounds([id], (state) => {
    const w = state.list.find((x) => x.uid === uid);
    if (!w) return;
    if (download) {
      w.variant = {
        image: { ...download.image },
        grid: { dpi: download.grid.dpi, offset: { ...download.grid.offset } },
      };
    } else {
      delete w.variant;
    }
  });

/** Ring und Schild unter dem Token neu zeichnen. */
export async function renderVisuals(tokenIds) {
  const { maxWounds } = await getSettings();
  const old = await OBR.scene.items.getItems((it) => {
    const v = it.metadata && it.metadata[VISUAL_KEY];
    return Boolean(v && tokenIds.includes(v.owner));
  });
  if (old.length) await OBR.scene.items.deleteItems(old.map((i) => i.id));

  const tokens = await OBR.scene.items.getItems(tokenIds);
  const dpi = await OBR.scene.grid.getDpi();
  const toAdd = [];
  for (const t of tokens) {
    const state = readState(t.metadata);
    const count = state.list.length;
    if (!count) continue;
    const stage = stageFor(count, maxWounds);
    const b = await OBR.scene.items.getItemBounds([t.id]);
    const meta = (kind) => ({ [VISUAL_KEY]: { owner: t.id, kind } });
    // Stehende Figur (hochkant): flacher Ring an den Füßen. Sonst: Ring um das Token.
    const figure = b.height > b.width * 1.3;
    let ringW, ringH, ringPos, size;
    if (figure) {
      ringW = Math.max(b.width * 1.15, b.height * 0.4);
      ringH = ringW * 0.38;
      ringPos = { x: b.center.x, y: b.max.y - ringH * 0.35 };
      size = b.height;
    } else {
      ringW = ringH = Math.min(b.width, b.height) * 1.04;
      ringPos = b.center;
      size = Math.min(b.width, b.height) * 1.6;
    }
    const heavy = stage.id === "critical" || stage.id === "down";
    const fs = Math.min(36, Math.max(5, size * 0.07));

    toAdd.push(
      buildShape()
        .shapeType("CIRCLE")
        .width(ringW)
        .height(ringH)
        .position(ringPos)
        .fillColor(stage.ring)
        .fillOpacity(stage.id === "down" ? 0.35 : 0.12)
        .strokeColor(stage.id === "down" ? "#b71c1c" : stage.ring)
        .strokeOpacity(1)
        .strokeWidth(Math.max(1.5, ringW * (heavy ? 0.06 : 0.04)))
        .attachedTo(t.id)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(t.visible)
        .disableAttachmentBehavior(["ROTATION"])
        .name("Wundenring")
        .metadata(meta("ring"))
        .build()
    );

    toAdd.push(
      buildLabel()
        .plainText(labelText(state, maxWounds))
        .position({ x: b.center.x, y: b.max.y + fs * 0.3 })
        .pointerDirection("UP")
        .pointerHeight(fs * 0.3)
        .pointerWidth(fs * 0.6)
        .backgroundColor(stage.bg)
        .backgroundOpacity(0.92)
        .fillColor("#ffffff")
        .fontWeight(700)
        .fontSize(fs)
        .lineHeight(1.2)
        .padding(fs * 0.35)
        .cornerRadius(fs * 0.4)
        .textAlign("CENTER")
        .attachedTo(t.id)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(t.visible)
        .disableAttachmentBehavior(["ROTATION", "SCALE"])
        .name("Wundenschild")
        .metadata(meta("label"))
        .build()
    );
  }
  if (toAdd.length) await OBR.scene.items.addItems(toAdd);
}

/** Alle verwundeten Tokens der Szene neu zeichnen (z. B. nach Änderung der Grenze). */
export async function rerenderAll() {
  const { maxWounds } = await getSettings();
  const wounded = await OBR.scene.items.getItems((it) => Boolean(it.metadata && it.metadata[WOUNDS_KEY]));
  const ids = wounded.map((i) => i.id);
  if (!ids.length) return;
  // Liegen und Bild an die neue Grenze anpassen
  await OBR.scene.items.updateItems(ids, (drafts) => {
    for (const d of drafts) {
      const s = applyStateToToken(d, readState(d.metadata), maxWounds);
      d.metadata[WOUNDS_KEY] = s;
    }
  });
  await renderVisuals(ids);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
