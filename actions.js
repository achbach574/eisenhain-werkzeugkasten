import OBR, { buildShape, buildLabel } from "./vendor/obr-sdk.js";
import {
  WOUNDS_KEY, VISUAL_KEY, SETTINGS_KEY, DEFAULT_SETTINGS,
  clampMax, stageFor, readState, labelText, makeWound, applyStateToToken,
} from "./core.js";

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
    const diameter = Math.min(b.width, b.height) * 1.04;
    const meta = (kind) => ({ [VISUAL_KEY]: { owner: t.id, kind } });

    toAdd.push(
      buildShape()
        .shapeType("CIRCLE")
        .width(diameter)
        .height(diameter)
        .position(b.center)
        .fillColor(stage.ring)
        .fillOpacity(stage.id === "down" ? 0.35 : 0)
        .strokeColor(stage.id === "down" ? "#b71c1c" : stage.ring)
        .strokeOpacity(1)
        .strokeWidth(Math.max(6, dpi * (stage.id === "critical" || stage.id === "down" ? 0.09 : 0.06)))
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
        .position({ x: b.center.x, y: b.max.y + dpi * 0.06 })
        .pointerDirection("UP")
        .pointerHeight(6)
        .pointerWidth(12)
        .backgroundColor(stage.bg)
        .backgroundOpacity(0.92)
        .fillColor("#ffffff")
        .fontWeight(700)
        .fontSize(22)
        .lineHeight(1.25)
        .padding(8)
        .cornerRadius(10)
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
