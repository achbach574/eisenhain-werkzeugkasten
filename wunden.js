import OBR from "./vendor/obr-sdk.js?v=6";
import { ID, CATALOG, readState, stageFor, hearts, maxFor, MAX_KEY } from "./core.js?v=6";
import { getSettings, addWound, healWound, setVariant, escapeHtml, mutateWounds } from "./actions.js?v=6";

const tokenId = new URLSearchParams(location.search).get("id");
const $ = (id) => document.getElementById(id);
let busy = false;

async function run(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } catch (e) {
    console.error(e);
    OBR.notification.show("Das hat nicht geklappt: " + (e && e.message ? e.message : e), "ERROR");
  } finally { busy = false; render(); }
}

async function render() {
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) { $("name").textContent = "Token nicht gefunden"; return; }
  const { maxWounds: globalMax } = await getSettings();
  const maxWounds = maxFor(token, globalMax);
  const own = token.metadata[MAX_KEY];
  $("hmax").innerHTML = `<option value="">Standard (${maxFor({ ...token, metadata: {} }, globalMax)})</option>` +
    [3, 4, 5, 6, 8, 10, 12, 15, 20, 30].map((n) => `<option value="${n}">${n}</option>`).join("");
  $("hmax").value = Number.isFinite(own) ? String(own) : "";
  const state = readState(token.metadata);
  const count = state.list.length;
  const stage = stageFor(count, maxWounds);

  $("name").textContent = token.text?.plainText || token.name || "Held";
  $("hearts").textContent = hearts(count, maxWounds);
  $("badge").textContent = `${stage.label} · ${count}/${maxWounds}`;
  $("badge").style.background = stage.bg;

  const cur = $("current");
  if (!count) {
    cur.innerHTML = `<div class="empty">Keine Wunden. Noch.</div>`;
  } else {
    cur.innerHTML = state.list.map((w) => `
      <div class="wound">
        <div class="ico">${escapeHtml(w.icon)}</div>
        <div><div class="name">${escapeHtml(w.name)}</div><div class="eff">${escapeHtml(w.effect)}</div>
          ${w.variant ? `<div class="eff">🖼️ Wundbild aktiv</div>` : ""}</div>
        <div class="btns">
          <button class="small" data-img="${w.uid}" title="${w.variant ? "Wundbild entfernen" : "Wundbild aus deinen Owlbear-Bildern wählen"}">${w.variant ? "🖼️✕" : "🖼️"}</button>
          <button class="small ok" data-heal="${w.uid}" title="Diese Wunde heilen">Heilen</button>
        </div>
      </div>`).join("");
  }
}

function buildCatalog() {
  $("catalog").innerHTML = CATALOG.map((w) => `
    <button data-add="${w.key}" title="${escapeHtml(w.effect)}">
      <span class="ci">${w.icon}</span><span>${escapeHtml(w.name)}</span>
    </button>`).join("");
}

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("button");
  if (!t) return;
  if (t.id === "close") { OBR.popover.close(`${ID}/popover`); return; }
  if (t.dataset.add) {
    const src = CATALOG.find((w) => w.key === t.dataset.add);
    run(() => addWound([tokenId], src));
  } else if (t.dataset.heal) {
    run(() => healWound([tokenId], t.dataset.heal));
  } else if (t.dataset.img) {
    const uid = t.dataset.img;
    run(async () => {
      const [token] = await OBR.scene.items.getItems([tokenId]);
      const w = readState(token.metadata).list.find((x) => x.uid === uid);
      if (w && w.variant) { await setVariant(tokenId, uid, null); return; }
      const picks = await OBR.assets.downloadImages(false, "", "CHARACTER");
      if (picks && picks[0]) await setVariant(tokenId, uid, picks[0]);
    });
  } else if (t.id === "cadd") {
    const name = $("cname").value.trim();
    if (!name) { $("cname").focus(); return; }
    const effect = $("ceffect").value.trim();
    $("cname").value = ""; $("ceffect").value = "";
    run(() => addWound([tokenId], { name, effect, icon: "🩸" }));
  }
});

$("hmax").addEventListener("change", (e) => {
  const v = e.target.value;
  run(() => mutateWounds([tokenId], (state, draft) => {
    if (v === "") delete draft.metadata[MAX_KEY];
    else draft.metadata[MAX_KEY] = Number(v);
  }));
});

$("ceffect").addEventListener("keydown", (e) => { if (e.key === "Enter") $("cadd").click(); });

OBR.onReady(async () => {
  buildCatalog();
  await render();
  OBR.scene.items.onChange(() => { if (!busy) render(); });
  OBR.room.onMetadataChange(() => render());
});
