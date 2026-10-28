import OBR from "./vendor/obr-sdk.js?v=5";
import { OV_MODAL } from "./show.js?v=5";
import { SHAKES } from "./data.js?v=5";

const stage = document.getElementById("stage");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let data = {};
try { data = JSON.parse(decodeURIComponent(location.hash.slice(1))); } catch { data = {}; }

let closer = null;
function closeIn(ms) {
  clearTimeout(closer);
  closer = setTimeout(() => { try { OBR.modal.close(OV_MODAL); } catch { /* Test */ } }, ms);
}

// ---------- Würfelgrafik ----------
const H = [[0, -95], [82.3, -47.5], [82.3, 47.5], [0, 95], [-82.3, 47.5], [-82.3, -47.5]];
const T = [0, -50], R = [43.3, 25], L = [-43.3, 25];
const D20_FACES = [
  { p: [T, R, L], shade: 0.78, center: true },
  { p: [T, R, H[1]], shade: 0.62, n: true }, { p: [R, L, H[3]], shade: 0.42, n: true }, { p: [L, T, H[5]], shade: 0.7, n: true },
  { p: [T, H[5], H[0]], shade: 0.9 }, { p: [T, H[0], H[1]], shade: 0.74 },
  { p: [R, H[1], H[2]], shade: 0.48 }, { p: [R, H[2], H[3]], shade: 0.34 },
  { p: [L, H[3], H[4]], shade: 0.4 }, { p: [L, H[4], H[5]], shade: 0.58 },
];
const SHAPES = {
  4: [[0, -92], [88, 70], [-88, 70]],
  6: [[-78, -78], [78, -78], [78, 78], [-78, 78]],
  8: [[0, -98], [80, 0], [0, 98], [-80, 0]],
  10: [[0, -96], [84, -10], [0, 96], [-84, -10]],
  12: [[0, -95], [90, -29], [56, 77], [-56, 77], [-90, -29]],
  100: [[0, -96], [84, -10], [0, 96], [-84, -10]],
};
const pts = (p) => p.map((q) => q.join(",")).join(" ");
const iron = (k) => {
  const v = Math.round(40 + k * 120);
  return `rgb(${v + 8},${v + 2},${v - 4})`;
};

function dieSvg(sides, value, crit) {
  const glow = crit === "pump" ? "#ffb000" : crit === "kater" ? "#c0201a" : "#ff6a2a";
  const defs = `<defs>
    <radialGradient id="ember" cx="50%" cy="60%" r="60%"><stop offset="0%" stop-color="${glow}" stop-opacity=".55"/><stop offset="100%" stop-color="${glow}" stop-opacity="0"/></radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .2  0 0 0 0 .1  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  </defs>`;
  let body = "";
  let numPos = [0, 6], fs = 44;
  if (sides === 20) {
    for (const f of D20_FACES) body += `<polygon points="${pts(f.p)}" fill="${iron(f.shade)}" stroke="#1b1612" stroke-width="2.2" stroke-linejoin="round"/>`;
    body += `<polygon points="${pts(H)}" fill="url(#grain)"/>`;
    // kleine Nachbarzahlen
    const side = [[47, -32, 14, "8"], [0, 62, 16, "14"], [-47, -32, 17, "2"]];
    for (const [x, y, rot, t] of side) body += `<text x="${x}" y="${y}" font-size="15" text-anchor="middle" class="num" style="opacity:.55" transform="rotate(${rot} ${x} ${y})">${t}</text>`;
    body += `<polygon points="${pts([T, R, L])}" fill="url(#sheen)"/>`;
    body += `<polygon points="${pts(H)}" fill="none" stroke="#1b1612" stroke-width="4" stroke-linejoin="round"/>`;
    numPos = [0, 13]; fs = value >= 10 ? 38 : 44;
  } else {
    const shape = SHAPES[sides] || SHAPES[6];
    body += `<polygon points="${pts(shape)}" fill="${iron(0.62)}" stroke="#1b1612" stroke-width="4" stroke-linejoin="round"/>`;
    body += `<polygon points="${pts(shape)}" fill="url(#grain)"/><polygon points="${pts(shape)}" fill="url(#sheen)"/>`;
    if (sides === 4) numPos = [0, 40];
    fs = String(value).length > 2 ? 46 : 62;
  }
  return `<svg class="die" viewBox="-135 -135 270 270" xmlns="http://www.w3.org/2000/svg">${defs}
    <circle cx="0" cy="10" r="130" fill="url(#ember)"/>${body}
    <text id="dieNum" x="${numPos[0]}" y="${numPos[1] + fs * 0.35}" font-size="${fs}" text-anchor="middle" class="num">${value}</text></svg>`;
}

function sparks(color) {
  const box = document.createElement("div");
  box.className = "sparks";
  for (let i = 0; i < 46; i++) {
    const s = document.createElement("div");
    s.className = "spark";
    const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 45;
    s.style.setProperty("--dx", `${Math.cos(a) * d}vw`);
    s.style.setProperty("--dy", `${Math.sin(a) * d}vh`);
    s.style.background = color;
    s.style.animationDelay = `${Math.random() * 0.15}s`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
}

function renderDice(r) {
  const modeTxt = r.mode === "vorteil" ? "mit Vorteil" : r.mode === "nachteil" ? "mit Nachteil" : "";
  const label = `${r.count > 1 ? r.count : ""}W${r.sides === 100 ? "100" : r.sides}`;
  stage.innerHTML = `<div class="veil"></div><div class="content">
    ${r.who ? `<div class="who">${esc(r.who)} würfelt ${label} ${modeTxt}</div>` : `<div class="who">${label} ${modeTxt}</div>`}
    <div id="dieBox">${dieSvg(r.sides, "?", null)}</div>
    <div id="after" class="hidden"></div></div>`;
  const die = stage.querySelector(".die");
  die.classList.add("rolling");
  const num = () => stage.querySelector("#dieNum");
  const tick = setInterval(() => { const n = num(); if (n) n.textContent = 1 + Math.floor(Math.random() * r.sides); }, 75);
  setTimeout(() => {
    clearInterval(tick);
    document.getElementById("dieBox").innerHTML = dieSvg(r.sides, r.count > 1 ? r.total - r.mod : r.kept, r.crit);
    stage.querySelector(".die").classList.add("landed");
    const parts = [];
    if (r.rolls.length > 1) parts.push(r.mode !== "normal" ? `Würfe: ${r.rolls.join(" und ")}` : `Würfe: ${r.rolls.join(" + ")}`);
    if (r.mod) parts.push(`Bonus ${r.mod > 0 ? "+" : ""}${r.mod}`);
    if (r.dc) parts.push(`Ziel ${r.dc}`);
    let html = "";
    if (r.crit === "pump") html += `<div class="crit pump cin">PUMP!</div>`;
    if (r.crit === "kater") html += `<div class="crit kater cin">Muskelkater!</div>`;
    if (r.mod || r.rolls.length > 1 && r.mode === "normal") html += `<div class="result cin">= ${r.total}</div>`;
    if (parts.length) html += `<div class="detail">${esc(parts.join(" · "))}</div>`;
    if (r.verdict) html += `<div class="verdict cin ${r.verdict}">${r.verdict === "erfolg" ? "Geschafft!" : "Daneben!"}</div>`;
    const after = document.getElementById("after");
    after.innerHTML = html;
    after.className = "content appear";
    if (r.crit === "pump") sparks("#ffcf5a");
    if (r.crit === "kater") sparks("#ff4a2a");
  }, 1300);
  closeIn(r.crit ? 7000 : 5200);
}

function renderShake(d) {
  const sh = SHAKES[d.n];
  stage.innerHTML = `<div class="veil"></div><div class="content">
    <div class="who">${d.who ? `${esc(d.who)} greift zum Shaker …` : "Shake-Roulette"}</div>
    <div class="cups">${[1, 2, 3, 4, 5, 6].map((k) => `<div class="cup" data-k="${k}">${SHAKES[k].icon}<small>${k}</small></div>`).join("")}</div>
    <div id="after" class="hidden"></div></div>`;
  const cups = [...stage.querySelectorAll(".cup")];
  // Lauflicht, das langsamer wird und auf dem Ergebnis stehen bleibt
  const steps = 18 + (d.n - 1);
  let i = 0, delay = 60;
  const step = () => {
    cups.forEach((c) => c.classList.remove("lit"));
    cups[i % 6].classList.add("lit");
    if (i >= steps) {
      cups[i % 6].classList.replace("lit", "win");
      const after = document.getElementById("after");
      after.innerHTML = `<div class="shname cin">${sh.icon} ${esc(sh.name)}</div><div class="sub">${esc(sh.effect)}</div>`;
      after.className = "content appear";
      sparks("#e0a0ff");
      return;
    }
    i++; delay *= 1.09;
    setTimeout(step, delay);
  };
  step();
  closeIn(11000);
}

function renderHandout(d) {
  stage.innerHTML = `<div class="veil dark"></div><div class="content">
    ${d.title ? `<div class="who">${esc(d.title)}</div>` : ""}
    <img class="handout" src="${esc(d.url)}" alt="">
    ${d.total > 1 ? `<div class="page">Seite ${d.page} von ${d.total}</div>` : ""}</div>`;
}

function renderSpruch(d) {
  stage.innerHTML = `<div class="veil"></div><div class="content"><div class="goblin">
    ${d.image ? `<img src="${esc(d.image)}" alt="">` : ""}
    <div class="bubble">${esc(d.text)}</div></div>
    ${d.sub ? `<div class="sub appear">${esc(d.sub)}</div>` : ""}</div>`;
  closeIn(5500);
}

function renderEvent(d) {
  stage.innerHTML = `<div class="veil"></div><div class="content">
    ${d.image ? `<img class="event-img" src="${esc(d.image)}" alt="">` : ""}
    <div class="event-title cin">${esc(d.title)}</div>
    <div class="sub appear">${esc(d.text)}</div></div>`;
  if (d.kind === "crush") sparks("#ff8ad8");
  closeIn(5500);
}

function render() {
  if (data.kind === "dice") renderDice(data);
  else if (data.kind === "shake") renderShake(data);
  else if (data.kind === "handout") renderHandout(data);
  else if (data.kind === "spruch") renderSpruch(data);
  else renderEvent(data);
}

OBR.onReady(() => {});
render();
