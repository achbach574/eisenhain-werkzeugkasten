import OBR from "./vendor/obr-sdk.js?v=6";
import { GOBLINS, GOBLIN_KEY, STACKS, stackKeyOf, goblinFor } from "./data.js?v=6";
import { CATALOG } from "./core.js?v=6";
import { addWound, escapeHtml } from "./actions.js?v=6";
import { showOverlay } from "./show.js?v=6";
import { moveBelt, returnStacks } from "./belt.js?v=6";
import { getSpiel } from "./state.js?v=6";
import { nameOfToken } from "./shake.js?v=6";
import { playStamp } from "./sound.js?v=6";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");

async function init() {
  const [tok] = await OBR.scene.items.getItems([id]);
  if (!tok) { document.body.innerHTML = "<div class='empty'>Token nicht gefunden.</div>"; return; }
  const g = GOBLINS[(tok.metadata[GOBLIN_KEY] || {}).key || goblinFor(tok)];
  if (!g) return;
  $("gName").textContent = g.name;
  $("gTitle").textContent = g.title;
  $("gLook").textContent = g.look;
  $("gLos").textContent = g.loswerden;
  $("gSpruch").textContent = `„${g.spruch}“ zeigen`;
  $("gSpruch").onclick = () => showOverlay({ kind: "spruch", image: tok.image.url, text: g.spruch, sub: g.name });

  const heroes = (await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE"))
    .filter((i) => !(i.metadata && i.metadata[GOBLIN_KEY]) && i.id !== id);
  const spiel = await getSpiel();
  const saved = (await OBR.scene.items.getItems((i) => Boolean(stackKeyOf(i))))
    .filter((i) => spiel.stapel[stackKeyOf(i)] === "gerettet");

  $("gActions").innerHTML = g.actions.map((a, k) => {
    let targets = "";
    if (a.wound) {
      const w = CATALOG.find((c) => c.key === a.wound);
      targets = `<div class="muted" style="margin:4px 0">Trifft wen? Wunde: ${w.icon} ${escapeHtml(w.name)}</div>
        <div class="catalog">${heroes.map((h) => `<button class="small" data-a="${k}" data-h="${h.id}">${escapeHtml(nameOfToken(h))}</button>`).join("") || "<div class='empty'>Keine Helden in der Szene.</div>"}</div>
        <button class="small" data-a="${k}" data-h="" style="margin-top:4px">Nur ansagen, keine Wunde</button>`;
    } else if (a.belt === "zurueck") {
      targets = `<div class="muted" style="margin:4px 0">Welchen geretteten Stapel?</div>
        <div class="catalog">${saved.map((s) => `<button class="small" data-a="${k}" data-s="${s.id}">${escapeHtml(STACKS[stackKeyOf(s)].short)}</button>`).join("") || "<div class='empty'>Noch kein Stapel gerettet.</div>"}</div>`;
    } else {
      targets = `<button class="small primary" data-a="${k}" style="margin-top:4px">Los!</button>`;
    }
    return `<div class="hero" style="border-left-color:#8b2a2a"><div class="hname">${escapeHtml(a.label)}</div><div class="muted">${escapeHtml(a.text)}</div>${targets}</div>`;
  }).join("");

  $("gActions").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b) return;
    const a = g.actions[Number(b.dataset.a)];
    b.disabled = true;
    try {
      let sub = a.text;
      if (a.wound && b.dataset.h) {
        const w = CATALOG.find((c) => c.key === a.wound);
        await addWound([b.dataset.h], w);
        const h = heroes.find((x) => x.id === b.dataset.h);
        sub = `${a.text} ${nameOfToken(h)}: ${w.icon} ${w.name}`;
      }
      if (a.belt === "zurueck" && b.dataset.s) {
        const names = await returnStacks([b.dataset.s]);
        if (names) sub = `${a.text} (${names.join(", ")})`;
      }
      await showOverlay({ kind: "spruch", image: tok.image.url, text: g.spruch, sub });
      if (a.belt === "vor") {
        await sleep(5800);
        const r = await moveBelt(1);
        if (r.crushed.length) { playStamp(); await sleep(1500); }
      }
      OBR.popover.close("eisenhain.werkzeugkasten/goblin-pop");
    } catch (err) {
      OBR.notification.show(String(err.message || err), "ERROR");
      b.disabled = false;
    }
  });
}
OBR.onReady(init);
