// Shake-Roulette: W6 entscheidet, welcher Shake aus Madame Makros Bar wirkt.
import OBR, { buildLabel } from "./vendor/obr-sdk.js?v=6";
import { ID } from "./core.js?v=6";
import { SHAKES } from "./data.js?v=6";
import { showOverlay } from "./show.js?v=6";

export const SHAKE_KEY = `${ID}/shake`;
export const SHAKE_VIS_KEY = `${ID}/shakeanzeige`;

export const nameOfToken = (t) => (t && ((t.text && t.text.plainText) || t.name)) || "Jemand";

export function rollD(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] % n) + 1;
}

/** Würfelt einen Shake für ein Token (oder ohne Token nur als Anzeige). */
export async function drinkShake(tokenId, fixed) {
  const n = fixed || rollD(6);
  let who = null;
  if (tokenId) {
    const [t] = await OBR.scene.items.getItems([tokenId]);
    who = nameOfToken(t);
    await OBR.scene.items.updateItems([tokenId], (ds) => { for (const d of ds) d.metadata[SHAKE_KEY] = { n }; });
  }
  await showOverlay({ kind: "shake", n, who });
  if (tokenId) setTimeout(() => renderShake([tokenId]), 5200);
  return n;
}

export async function removeShake(ids) {
  await OBR.scene.items.updateItems(ids, (ds) => { for (const d of ds) delete d.metadata[SHAKE_KEY]; });
  await renderShake(ids);
}

export async function renderShake(ids) {
  const old = await OBR.scene.items.getItems((it) => {
    const v = it.metadata && it.metadata[SHAKE_VIS_KEY];
    return Boolean(v && ids.includes(v.owner));
  });
  if (old.length) await OBR.scene.items.deleteItems(old.map((i) => i.id));
  const tokens = await OBR.scene.items.getItems(ids);
  const add = [];
  for (const t of tokens) {
    const s = t.metadata[SHAKE_KEY];
    if (!s) continue;
    const sh = SHAKES[s.n];
    const b = await OBR.scene.items.getItemBounds([t.id]);
    const fs = Math.min(30, Math.max(5, Math.max(b.height, b.width) * 0.06));
    add.push(buildLabel()
      .plainText(`${sh.icon} ${sh.name}`)
      .position({ x: b.center.x, y: b.min.y - fs * 0.4 })
      .pointerDirection("DOWN")
      .pointerHeight(fs * 0.3)
      .pointerWidth(fs * 0.6)
      .backgroundColor("#7a3fa0")
      .backgroundOpacity(0.92)
      .fillColor("#ffffff")
      .fontWeight(700)
      .fontSize(fs)
      .padding(fs * 0.35)
      .cornerRadius(fs * 0.4)
      .textAlign("CENTER")
      .attachedTo(t.id)
      .layer("ATTACHMENT")
      .locked(true)
      .disableHit(true)
      .visible(t.visible)
      .disableAttachmentBehavior(["ROTATION", "SCALE"])
      .name("Shake-Effekt")
      .metadata({ [SHAKE_VIS_KEY]: { owner: t.id } })
      .build());
  }
  if (add.length) await OBR.scene.items.addItems(add);
}
