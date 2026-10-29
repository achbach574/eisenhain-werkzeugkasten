import OBR from "./vendor/obr-sdk.js?v=6";
import { WOUNDS_KEY, readState, stageFor, hearts, maxFor } from "./core.js?v=6";
import { getSettings, setSettings, rerenderAll, healAll, escapeHtml } from "./actions.js?v=6";
import { readScene, runCommands } from "./layout.js?v=6";
import { getCountdown, placeCountdown, stepCountdown, removeCountdown, TAKT_EVENTS, HERZ_KEY, HERZ_MAX } from "./finale.js?v=6";
import { ID } from "./core.js?v=6";
import { STACKS } from "./data.js?v=6";
import { getSpiel, changeSpiel, resetSpiel, countdownStart, folgen, applyTags, countSaved } from "./state.js?v=6";
import { moveBelt, resetBelt, stopHammer } from "./belt.js?v=6";
import { hideOverlay, showOverlay } from "./show.js?v=6";
import { makeRoll, playRoll } from "./dice.js?v=6";
import { playDong, playStamp } from "./sound.js?v=6";
import { drinkShake, nameOfToken } from "./shake.js?v=6";

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
    const mx = maxFor(c, maxWounds);
    const st = stageFor(n, mx);
    return `<div class="hero" style="border-left-color:${st.bg}">
      <div class="top">
        <span class="hname">${escapeHtml(c.text?.plainText || c.name || "Held")}</span>
        <span class="badge" style="background:${st.bg}">${st.label}</span>
      </div>
      <div class="hearts" style="font-size:20px;margin-top:4px">${hearts(n, mx)}</div>
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

// ---- Reiter ----
const TABS = ["W", "G", "D", "K", "F", "S"];
const show = (t) => {
  for (const k of TABS) {
    $("sec" + k).hidden = t !== k;
    $("tab" + k).classList.toggle("active", t === k);
  }
  try { localStorage.setItem(`${ID}/tab`, t); } catch { /* egal */ }
  if (t === "F") renderFinale();
  if (t === "G") renderSpiel();
  if (t === "D") renderWho();
  if (t === "K") renderSkript();
};
for (const k of TABS) $("tab" + k).addEventListener("click", () => show(k));
$("ovClose").addEventListener("click", () => hideOverlay());
OBR.onReady(() => {
  let t = "W";
  try { t = localStorage.getItem(`${ID}/tab`) || "W"; } catch { /* egal */ }
  show(TABS.includes(t) ? t : "W");
});

// ---- Finale ----
async function renderFinale() {
  if (!(await OBR.scene.isReady())) return;
  const v = await getCountdown();
  $("cdNum").textContent = v == null ? "–" : String(v);
  const sp = await getSpiel();
  const start = countdownStart(sp);
  $("cdHint").textContent = `Startwert laut Spielstand: ${start}`;
  if (v == null) $("cdStart").value = String(Math.max(4, start));
  $("cdEvent").innerHTML = v == null
    ? "Noch kein Countdown in dieser Szene."
    : `<b>Takt ${v}:</b> ${escapeHtml(TAKT_EVENTS[v] || "")}`;
  const chars = await OBR.scene.items.getItems((i) => Boolean(i.metadata && i.metadata[HERZ_KEY]));
  $("herzList").innerHTML = chars.map((c) => {
    const n = c.metadata[HERZ_KEY].n;
    return `<div class="hero" style="border-left-color:#c9a24a"><div class="top"><span class="hname">${escapeHtml(c.text?.plainText || c.name || "?")}</span><span class="hearts" style="font-size:20px">${"♥".repeat(n)}${"♡".repeat(HERZ_MAX - n)}</span></div>${n >= HERZ_MAX ? '<div class="muted" style="margin-top:4px">Drei Herzpunkte: Karl bleibt stehen.</div>' : ""}</div>`;
  }).join("") || '<div class="empty">Noch keine Herzpunkte vergeben.</div>';
}
const safe = (fn) => async () => { try { await fn(); } catch (e) { OBR.notification.show(String(e.message || e), "ERROR"); } renderFinale(); };
$("cdMinus").addEventListener("click", safe(() => { playDong(); return stepCountdown(-1); }));
$("cdPlus").addEventListener("click", safe(() => stepCountdown(1)));
$("cdPlace").addEventListener("click", safe(() => placeCountdown(Number($("cdStart").value))));
$("cdRemove").addEventListener("click", safe(() => removeCountdown()));
OBR.onReady(() => { OBR.scene.items.onChange(() => { if (!$("secF").hidden) renderFinale(); }); });

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

// ---- Spielstand und Fließband ----
const STATUS_TXT = { band: "auf dem Band", gerettet: "gerettet", verloren: "verloren" };
async function renderSpiel() {
  const s = await getSpiel();
  for (const b of $("segHalle").children) b.classList.toggle("on", (b.dataset.v === "1") === s.halle);
  for (const b of $("segRita").children) b.classList.toggle("on", b.dataset.v === s.rita);
  $("stNum").textContent = String(s.stuerze);
  for (const c of $("hammer").querySelectorAll("input")) c.checked = s.hammer >= Number(c.dataset.h);
  $("stackList").innerHTML = Object.entries(STACKS).map(([k, st]) => `<div class="stack ${s.stapel[k]}">
      <span class="k">${k}</span><span>${escapeHtml(st.name)}</span>
      <select data-k="${k}">${Object.entries(STATUS_TXT).map(([v, t]) => `<option value="${v}" ${s.stapel[k] === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>`).join("")
    + `<div class="muted">Gerettet: <b>${countSaved(s)} von 5</b></div>`;
  $("folgen").innerHTML = folgen(s).map((f) => `<p style="margin:0 0 5px">${f}</p>`).join("");
}
const spielSafe = (fn) => async (e) => { try { await fn(e); } catch (err) { OBR.notification.show(String(err.message || err), "ERROR"); } renderSpiel(); };
$("segHalle").addEventListener("click", spielSafe(async (e) => { const b = e.target.closest("button"); if (b) await changeSpiel((s) => { s.halle = b.dataset.v === "1"; }); }));
$("segRita").addEventListener("click", spielSafe(async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  await changeSpiel((s) => { s.rita = b.dataset.v; });
  if (b.dataset.v === "umgedreht") await showOverlay({ kind: "event", title: "Rita senkt das Klemmbrett", text: "„Er ist unten. Beim großen Wiederholer. Und er schläft nicht mehr.“" });
}));
$("stMinus").addEventListener("click", spielSafe(() => changeSpiel((s) => { s.stuerze -= 1; })));
$("stPlus").addEventListener("click", spielSafe(() => changeSpiel((s) => { s.stuerze += 1; })));
$("stackList").addEventListener("change", spielSafe(async (e) => { const k = e.target.dataset.k; if (k) await changeSpiel((s) => { s.stapel[k] = e.target.value; }); }));
$("hammer").addEventListener("change", spielSafe(async (e) => {
  const h = Number(e.target.dataset.h);
  const s = await changeSpiel((x) => { x.hammer = e.target.checked ? Math.max(x.hammer, h) : h - 1; });
  if (s.hammer >= 3 && e.target.checked) await stopHammer();
}));
const beltSafe = (fn) => async (e) => {
  const btn = e.currentTarget; btn.disabled = true;
  try {
    const r = await fn();
    if (r && r.crushed && r.crushed.length) playStamp();
    if (r && r.msg) $("beltMsg").textContent = r.msg;
  }
  catch (err) { $("beltMsg").textContent = "Fehler: " + (err.message || err); }
  btn.disabled = false; renderSpiel();
};
$("beltNext").addEventListener("click", beltSafe(() => moveBelt(1)));
$("beltBack").addEventListener("click", beltSafe(() => moveBelt(-1)));
$("beltReset").addEventListener("click", beltSafe(async () => { await resetBelt(); return { msg: "Alle Stapel liegen wieder auf ihren Startfeldern." }; }));
$("tagsNow").addEventListener("click", spielSafe(async () => {
  const n = await applyTags(await getCountdown());
  OBR.notification.show(n ? `${n} Token(s) ein- oder ausgeblendet.` : "Alles passt schon zum Spielstand.");
}));
$("spielReset").addEventListener("click", spielSafe(async () => { if (confirmTwice("spielReset")) await resetSpiel(); }));
const armed = {};
function confirmTwice(key) {
  if (armed[key]) { armed[key] = false; $(key).textContent = "Spielstand zurücksetzen"; return true; }
  armed[key] = true; $(key).textContent = "Wirklich? Nochmal klicken";
  setTimeout(() => { armed[key] = false; $(key).textContent = "Spielstand zurücksetzen"; }, 3000);
  return false;
}
OBR.onReady(() => { OBR.room.onMetadataChange(() => { if (!$("secG").hidden) renderSpiel(); }); });

// ---- Würfel ----
let dc = 0, selected = null;
async function renderWho() {
  const sel = (await OBR.player.getSelection()) || [];
  selected = null;
  if (sel.length) {
    const [t] = await OBR.scene.items.getItems([sel[0]]);
    if (t && t.layer === "CHARACTER") selected = t;
  }
  $("dWho").textContent = selected ? nameOfToken(selected) : "niemand ausgewählt";
  $("dShake").textContent = selected ? `🥤 ${nameOfToken(selected)} trinkt einen Shake (W6)` : "🥤 Shake würfeln (W6, ohne Held)";
}
for (const b of $("segDc").children) b.classList.toggle("on", b.dataset.v === "0");
$("segDc").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  dc = Number(b.dataset.v);
  for (const x of $("segDc").children) x.classList.toggle("on", x === b);
});
const log = [];
async function roll(opts) {
  const who = selected ? nameOfToken(selected) : null;
  const r = makeRoll({ ...opts, mod: Number($("dMod").value), dc: opts.sides === 20 ? dc : 0, who });
  playRoll(r.crit);
  await showOverlay(r);
  const crit = r.crit === "pump" ? " PUMP!" : r.crit === "kater" ? " Muskelkater!" : "";
  log.unshift(`${who ? who + ": " : ""}${r.count > 1 ? r.count : ""}W${r.sides}${r.mode !== "normal" ? " " + r.mode : ""} → ${r.rolls.join("/")}${r.mod ? (r.mod > 0 ? " +" : " ") + r.mod : ""} = ${r.total}${crit}${r.verdict ? (r.verdict === "erfolg" ? " ✔" : " ✘") : ""}`);
  $("dLog").textContent = log.slice(0, 8).join("\n");
}
$("d20").addEventListener("click", () => roll({ sides: 20 }));
$("dAdv").addEventListener("click", () => roll({ sides: 20, mode: "vorteil" }));
$("dDis").addEventListener("click", () => roll({ sides: 20, mode: "nachteil" }));
$("others").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  roll({ sides: Number(b.dataset.s), count: Number($("dCount").value) });
});
$("dShake").addEventListener("click", async () => {
  playRoll(null);
  const n = await drinkShake(selected ? selected.id : null);
  log.unshift(`${selected ? nameOfToken(selected) + ": " : ""}Shake → ${n}`);
  $("dLog").textContent = log.slice(0, 8).join("\n");
});
OBR.onReady(() => { OBR.player.onChange(() => { if (!$("secD").hidden) renderWho(); }); });

// ---- Spielleiter-Skript ----
const SZENE_KEY = `${ID}/szene`;
let skript = null;
async function loadSkript() {
  if (!skript) skript = await (await fetch(new URL("assets/skript.json?v=6", location.href))).json();
  return skript;
}
async function renderSkript() {
  const sk = await loadSkript();
  if (!$("kScene").options.length) {
    $("kScene").innerHTML = sk.map((s) => `<option value="${s.id}">${escapeHtml(s.title.replace(/^Szene (\d+): /, "$1 · "))}</option>`).join("");
  }
  let id = sk[1] ? sk[1].id : sk[0].id;
  if (await OBR.scene.isReady()) {
    const m = await OBR.scene.getMetadata();
    if (m[SZENE_KEY] && sk.some((s) => s.id === m[SZENE_KEY])) id = m[SZENE_KEY];
  }
  $("kScene").value = id;
  const sc = sk.find((s) => s.id === id);
  const cls = (t) => (t || "").toLowerCase().split(/[: ]/)[0].replace(/[^a-zäöü]/g, "");
  $("kChips").innerHTML = sc.blocks.map((b, k) => b.tag ? `<button data-k="${k}">${escapeHtml(b.tag.split(":")[0])}</button>` : "").join("");
  $("kBody").innerHTML = sc.blocks.map((b, k) => `<div class="blk ${cls(b.tag)}" id="blk${k}">${b.tag ? `<div class="tag">${escapeHtml(b.tag)}</div>` : ""}${b.html}</div>`).join("");
}
$("kScene").addEventListener("change", async () => {
  if (await OBR.scene.isReady()) await OBR.scene.setMetadata({ [SZENE_KEY]: $("kScene").value });
  renderSkript();
  $("kBody").scrollIntoView();
});
$("kChips").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  document.getElementById("blk" + b.dataset.k).scrollIntoView({ behavior: "smooth", block: "start" });
});
$("kBig").addEventListener("click", () => $("kBody").classList.toggle("big"));
OBR.onReady(() => { OBR.scene.onReadyChange(() => { if (!$("secK").hidden) renderSkript(); }); });
