import OBR from "./vendor/obr-sdk.js?v=5";
import { showOverlay, hideOverlay } from "./show.js?v=5";

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const ids = (q.get("ids") || "").split(",").filter(Boolean);
let i = Number(q.get("i") || 0);
let pages = [];

const title = (it) => ((it.text && it.text.plainText) || it.name || "").replace(/\[[^\]]*\]/g, "").replace(/[\s_-]*\d+\s*$/, "").trim();

function show() {
  const p = pages[i];
  if (!p) return;
  showOverlay({ kind: "handout", url: p.image.url, title: title(p), page: i + 1, total: pages.length });
  $("hInfo").textContent = pages.length > 1 ? `${title(p)} · Seite ${i + 1} von ${pages.length}` : title(p);
  [...$("hThumbs").children].forEach((im, k) => im.classList.toggle("on", k === i));
  $("hPrev").disabled = i === 0;
  $("hNext").disabled = i >= pages.length - 1;
  $("hPrev").hidden = $("hNext").hidden = pages.length < 2;
}

OBR.onReady(async () => {
  const got = await OBR.scene.items.getItems(ids);
  pages = ids.map((id) => got.find((g) => g.id === id)).filter(Boolean);
  $("hThumbs").innerHTML = pages.map((p, k) => `<img src="${p.image.url}" data-k="${k}" alt="">`).join("");
  $("hThumbs").onclick = (e) => { const k = e.target.dataset && e.target.dataset.k; if (k != null) { i = Number(k); show(); } };
  $("hPrev").onclick = () => { if (i > 0) { i--; show(); } };
  $("hNext").onclick = () => { if (i < pages.length - 1) { i++; show(); } };
  $("hClose").onclick = async () => { await hideOverlay(); OBR.popover.close("eisenhain.werkzeugkasten/handout-pop"); };
  show();
});
