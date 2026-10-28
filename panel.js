import OBR from "./vendor/obr-sdk.js?v=3";
import { WOUNDS_KEY, readState, stageFor, hearts } from "./core.js?v=3";
import { getSettings, setSettings, rerenderAll, healAll, escapeHtml } from "./actions.js?v=3";
import { readScene, runCommands } from "./layout.js?v=3";

const $ = (id) => document.getElementById(id);

function rulesHtml(max) {
  return `
    <p style="margin:0 0 6px"><b>Jede Wunde kostet ein Herz.</b> Ein Held hat ${max} Herzen.</p>
    <p style="margin:0 0 6px"><b>Kritisch</b> (noch 1 Herz): Der Held spürt es. Jede weitere Wunde wirft ihn um.</p>
    <p style="margin:0 0 6px"><b>Am Boden</b> (0 Herzen): Das Token kippt um. Der Held kann nicht handeln.
      Die anderen haben bis zum Ende der nächsten Runde Zeit, ihn zu stabilisieren, also eine Wunde zu heilen.
      Schaffen sie es nicht, stirbt der Held, oder die Spielleitung findet einen dramatischen Ausweg.</p>
    <p style="margin:0"><b>Heilen:</b> Ausruhen, Heiltränke, Hilde, Spotter-Handschuhe, die Stilleminute in Karls Pausenraum.</p>`;
}

async function render() {
  if (!(await OBR.scene.isReady())) {
    $("heroes").innerHTML = `<div class="empty">Keine Szene geöffnet.</div>`;
    return;
  }
  const { maxWounds } = await getSettings();
  $("max").value = String(maxWounds);
  $("rules").innerHTML = rulesHtml(maxWounds);

  const chars = await OBR.scene.items.getItems((it) => it.layer === "CHARACTER" && it.type === "IMAGE");
  const rows = chars.map((c) => ({ c, s: readState(c.metadata) }))
    .sort((a, b) => b.s.list.length - a.s.list.length);
  const wounded = rows.filter((r) => r.s.list.length);
  const fit = rows.filter((r) => !r.s.list.length);

  let html = wounded.map(({ c, s }) => {
    const n = s.list.length;
    const st = stageFor(n, maxWounds);
    return `<div class="hero" style="border-left-color:${st.bg}">
      <div class="top">
        <span class="hname">${escapeHtml(c.text?.plainText || c.name || "Held")}</span>
        <span class="badge" style="background:${st.bg}">${st.label}</span>
      </div>
      <div class="hearts" style="font-size:20px;margin-top:4px">${hearts(n, maxWounds)}</div>
      <ul>${s.list.map((w) => `<li>${escapeHtml(w.icon)} <b>${escapeHtml(w.name)}</b> <span class="eff">· ${escapeHtml(w.effect)}</span></li>`).join("")}</ul>
    </div>`;
  }).join("");
  if (!wounded.length) html = `<div class="empty">Alle Helden sind unverletzt.</div>`;
  if (fit.length) {
    html += `<div class="muted" style="margin-top:6px">Fit: ${fit.map((r) => escapeHtml(r.c.text?.plainText || r.c.name || "?")).join(", ")}</div>`;
  }
  $("heroes").innerHTML = html;
}

$("max").addEventListener("change", async (e) => {
  await setSettings({ maxWounds: Number(e.target.value) });
  await rerenderAll();
  render();
});

$("healall").addEventListener("click", () => $("confirm").classList.add("show"));
$("no").addEventListener("click", () => $("confirm").classList.remove("show"));
$("yes").addEventListener("click", async () => {
  $("confirm").classList.remove("show");
  const items = await OBR.scene.items.getItems((it) => Boolean(it.metadata && it.metadata[WOUNDS_KEY]));
  await healAll(items.map((i) => i.id));
  render();
});

OBR.onReady(() => {
  render();
  OBR.scene.onReadyChange(() => render());
  OBR.scene.items.onChange(() => render());
  OBR.room.onMetadataChange(() => render());
});

// ---- Szenen-Baukasten ----
const show = (s) => {
  $("secW").hidden = s !== "W"; $("secS").hidden = s !== "S";
  $("tabW").classList.toggle("active", s === "W"); $("tabS").classList.toggle("active", s === "S");
};
$("tabW").addEventListener("click", () => show("W"));
$("tabS").addEventListener("click", () => show("S"));

$("read").addEventListener("click", async () => {
  try {
    const rows = await readScene();
    $("out").textContent = rows.map((r) =>
      `${r.name}${r.label ? ` [${r.label}]` : ""} · ${r.layer} · x ${r.x} y ${r.y} h ${r.h}`).join("\n") || "Keine Tokens.";
  } catch (e) { $("out").textContent = "Fehler: " + (e.message || e); }
});

$("run").addEventListener("click", async () => {
  let cmds;
  try { cmds = JSON.parse($("cmds").value); }
  catch (e) { $("out").textContent = "Befehle sind kein gültiges JSON: " + e.message; return; }
  $("out").textContent = "Läuft …";
  try {
    const log = await runCommands(cmds);
    $("out").textContent = log.join("\n");
  } catch (e) { $("out").textContent = "Fehler: " + (e.message || e); }
});
