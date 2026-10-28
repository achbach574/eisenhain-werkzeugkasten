// Finale: Countdown-Scheibe und Herzpunkte.
import OBR, { buildImage } from "./vendor/obr-sdk.js?v=5";
import { ID } from "./core.js?v=5";
import { findMap } from "./layout.js?v=5";

export const CD_KEY = `${ID}/countdown`;
export const HERZ_KEY = `${ID}/herzpunkte`;
export const HERZ_VIS_KEY = `${ID}/herzanzeige`;
export const HERZ_MAX = 3;

export const TAKT_EVENTS = {
  8: "Kettenpeitsche: Zwei Ketten schlagen quer durch die Halle. Wer getroffen wird, fällt um.",
  7: "Laufbandboden: Wer in seinem Zug nicht läuft, rutscht zwei Felder Richtung Wand.",
  6: "Rosa Hantelregen: Hunderte Ein-Kilo-Hanteln fallen von der Decke. Wenig Schaden, viel Chaos.",
  5: "Roter Blick: Ein Held muss mitzählen und verliert seine Aktion, bis ihn jemand mit Namen ruft oder festhält.",
  4: "Hilde erscheint im Aufzug. Ihre Worte zählen als Herzpunkt, ihre Pfeife stoppt einmal eine Runde.",
  3: "Ventilatoren: Sturmwind. Fernangriffe sind schwer.",
  2: "Dampfstöße: Wer neben der Maschine steht, wird zurückgeschleudert.",
  1: "Der Schrein leuchtet. Karl läuft schneller als je zuvor: „Noch einer!“",
  0: "Der Countdown ist abgelaufen. Ende C: Ganz Pumpfurt joggt.",
};

const asset = (p) => new URL(p, window.location.href).href;
const cdUrl = (n) => asset(`assets/countdown_${Math.max(0, Math.min(8, n))}.png`);

async function cdItems() {
  return OBR.scene.items.getItems((i) => Boolean(i.metadata && i.metadata[CD_KEY]));
}

export async function getCountdown() {
  const [it] = await cdItems();
  return it ? it.metadata[CD_KEY].value : null;
}

/** Legt die Countdown-Scheibe neu an oder setzt sie auf den Startwert zurück. */
export async function placeCountdown(start) {
  const old = await cdItems();
  if (old.length) {
    await setCountdown(start);
    return;
  }
  const { b } = await findMap();
  const sdpi = await OBR.scene.grid.getDpi();
  const size = 256;
  const item = buildImage({ url: cdUrl(start), width: size, height: size, mime: "image/png" }, { dpi: size, offset: { x: size / 2, y: size / 2 } })
    .layer("PROP")
    .name("Countdown")
    .metadata({ [CD_KEY]: { value: start } })
    .build();
  const s = (0.16 * b.height) / sdpi;
  item.scale = { x: s, y: s };
  item.position = { x: b.min.x + 0.5 * b.width, y: b.min.y + 0.12 * b.height };
  await OBR.scene.items.addItems([item]);
}

export async function setCountdown(value) {
  const v = Math.max(0, Math.min(8, value));
  const items = await cdItems();
  if (!items.length) return null;
  await OBR.scene.items.updateItems(items.map((i) => i.id), (drafts) => {
    for (const d of drafts) {
      d.image.url = cdUrl(v);
      d.metadata[CD_KEY] = { value: v };
    }
  });
  return v;
}

export async function stepCountdown(delta) {
  const cur = await getCountdown();
  if (cur == null) return null;
  return setCountdown(cur + delta);
}

export async function removeCountdown() {
  const items = await cdItems();
  if (items.length) await OBR.scene.items.deleteItems(items.map((i) => i.id));
}

// ---- Herzpunkte ----
export async function changeHerz(ids, delta) {
  await OBR.scene.items.updateItems(ids, (drafts) => {
    for (const d of drafts) {
      const cur = (d.metadata[HERZ_KEY] && d.metadata[HERZ_KEY].n) || 0;
      const n = Math.max(0, Math.min(HERZ_MAX, cur + delta));
      if (n === 0) delete d.metadata[HERZ_KEY];
      else d.metadata[HERZ_KEY] = { n };
    }
  });
  await renderHerz(ids);
}

export async function renderHerz(ids) {
  const old = await OBR.scene.items.getItems((it) => {
    const v = it.metadata && it.metadata[HERZ_VIS_KEY];
    return Boolean(v && ids.includes(v.owner));
  });
  if (old.length) await OBR.scene.items.deleteItems(old.map((i) => i.id));
  const tokens = await OBR.scene.items.getItems(ids);
  const sdpi = await OBR.scene.grid.getDpi();
  const add = [];
  for (const t of tokens) {
    const n = (t.metadata[HERZ_KEY] && t.metadata[HERZ_KEY].n) || 0;
    if (!n) continue;
    const b = await OBR.scene.items.getItemBounds([t.id]);
    const heart = Math.max(b.width * 0.42, b.height * 0.16);
    const gap = heart * 0.08;
    const total = HERZ_MAX * heart + (HERZ_MAX - 1) * gap;
    for (let k = 0; k < HERZ_MAX; k++) {
      const size = 256;
      const img = buildImage({ url: asset(k < n ? "assets/herz_voll.png" : "assets/herz_leer.png"), width: size, height: size, mime: "image/png" },
        { dpi: size, offset: { x: size / 2, y: size / 2 } })
        .layer("ATTACHMENT")
        .attachedTo(t.id)
        .locked(true)
        .disableHit(true)
        .visible(t.visible)
        .disableAttachmentBehavior(["ROTATION", "SCALE"])
        .name("Herzpunkt")
        .metadata({ [HERZ_VIS_KEY]: { owner: t.id } })
        .build();
      const s = heart / sdpi;
      img.scale = { x: s, y: s };
      img.position = { x: b.center.x - total / 2 + heart / 2 + k * (heart + gap), y: b.min.y - heart * 0.65 };
      add.push(img);
    }
  }
  if (add.length) await OBR.scene.items.addItems(add);
}
