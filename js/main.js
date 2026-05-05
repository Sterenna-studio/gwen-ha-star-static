
import { TICKER_MESSAGES, PROJECTS, TOOLS, CONTACTS } from "./data.js";
import { initRadar } from "./radar.js";

// ── TICKER ────────────────────────────────────────────────────────────────
function buildTicker() {
  const track = document.getElementById("ticker-track");
  if (!track) return;
  const items = [...TICKER_MESSAGES, ...TICKER_MESSAGES];
  track.innerHTML = items.map(msg =>
    `<span class="ticker-item">
      <span class="ticker-sep">◆</span>
      <span>${msg}</span>
    </span>`
  ).join("");
}

// ── TILE FACTORY ─────────────────────────────────────────────────────────
function createTile(item) {
  const el = document.createElement(item.href && item.href !== "#" ? "a" : "div");
  if (item.href && item.href !== "#") {
    el.href   = item.href;
    el.target = "_blank";
    el.rel    = "noopener noreferrer";
  }
  el.className = "tile" + (item.featured ? " featured" : "");
  el.style.setProperty("--tile-color", item.color);
  el.setAttribute("aria-label", item.title);

  el.innerHTML = `
    <span class="tile-tag">${item.tag}</span>
    <span class="tile-title">${item.title}</span>
    <span class="tile-desc">${item.desc}</span>
    <span class="tile-badge ${item.badge}">${item.badgeLabel}</span>
    ${item.href && item.href !== "#" ? '<span class="tile-arrow" aria-hidden="true">↗</span>' : ""}
  `;
  return el;
}

// ── GRIDS ─────────────────────────────────────────────────────────────────
function buildGrid(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  items.forEach(item => container.appendChild(createTile(item)));
}

// ── CONTACT ───────────────────────────────────────────────────────────────
function buildContacts() {
  const grid = document.getElementById("contact-grid");
  if (!grid) return;
  CONTACTS.forEach(c => {
    const a = document.createElement("a");
    a.href   = c.href;
    a.target = "_blank";
    a.rel    = "noopener noreferrer";
    a.className = "contact-card";
    const iconHtml = c.icon.startsWith("<")
      ? c.icon
      : `<span>${c.icon}</span>`;
    a.innerHTML = `
      <span class="contact-icon">${iconHtml}</span>
      <span class="contact-label">${c.label}</span>
      <span class="contact-arrow">↗</span>
    `;
    grid.appendChild(a);
  });
}

// ── SMOOTH SCROLL for in-page anchors ─────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", e => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// ── INIT ──────────────────────────────────────────────────────────────────
buildTicker();
buildGrid("hub-grid", PROJECTS);
buildGrid("tools-grid", TOOLS);
buildContacts();
initRadar("radar-canvas");
