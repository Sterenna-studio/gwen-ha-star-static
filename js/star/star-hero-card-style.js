import {
  applyHeroCardStyleConfig,
  loadHeroCardStyleConfig,
} from './hero-card-style-config.js';

const STYLE_ID = 'star-hero-card-style-v2';

applyHeroCardStyleConfig(document.documentElement, loadHeroCardStyleConfig());

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bento-hero-row {
      grid-column: 1 / -1;
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--star-hero-gap, 14px);
      align-items: stretch;
      margin: 2px 0 4px;
    }

    .bento-hero-row .bc-nitro-hero {
      position: relative;
      min-height: var(--star-hero-min-height, 236px) !important;
      padding: 0 !important;
      border: 0;
      background: transparent;
      overflow: visible;
      isolation: isolate;
    }

    .bc-nitro-hero[data-app="star-arcade"] { --hero-accent: var(--c-amber); --hero-accent-2: #ff4d5a; --hero-glyph: 'ARCADE'; }
    .bc-nitro-hero[data-app="botanica"] { --hero-accent: var(--c-green); --hero-accent-2: #7cffcb; --hero-glyph: 'BOTANICA'; }
    .bc-nitro-hero[data-app="clicker"] { --hero-accent: var(--c-cyan); --hero-accent-2: #8b5cf6; --hero-glyph: 'CORE'; }
    .bc-nitro-hero[data-app="arena"] { --hero-accent: var(--c-primary); --hero-accent-2: #00d4ff; --hero-glyph: 'SKILL'; }
    .bc-nitro-hero[data-app="dedale"] { --hero-accent: var(--c-amber); --hero-accent-2: #b87333; --hero-glyph: 'S.T.E.A.M'; }
    .bc-nitro-hero[data-app="tcg"] { --hero-accent: var(--c-purple); --hero-accent-2: #ffd166; --hero-glyph: 'TCG'; }
    .bc-nitro-hero[data-app="bzh-universe"] { --hero-accent: var(--c-acid, #b7ff3c); --hero-accent-2: #38bdf8; --hero-glyph: 'BZH'; }
    .bc-nitro-hero[data-app="pokegang"] { --hero-accent: var(--c-red); --hero-accent-2: #facc15; --hero-glyph: 'POKEGANG'; }

    .hero-card--nitro {
      position: relative;
      min-height: var(--star-hero-min-height, 236px);
      height: 100%;
      display: grid;
      grid-template-rows: var(--star-hero-scene-height, 112px) 1fr;
      text-decoration: none;
      color: var(--c-text);
      border: 1px solid color-mix(in oklch, var(--hero-accent, var(--c-primary)) var(--star-hero-border-strength, 36%), var(--c-border));
      border-radius: var(--star-hero-radius, 18px);
      background:
        linear-gradient(135deg, color-mix(in oklch, var(--hero-accent, var(--c-primary)) var(--star-hero-accent-fill, 12%), transparent), transparent 46%),
        radial-gradient(circle at 18% 0%, color-mix(in oklch, var(--hero-accent-2, var(--c-cyan)) 20%, transparent), transparent 38%),
        color-mix(in oklch, var(--c-surface) 92%, #02040a);
      box-shadow: 0 14px 34px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(255,255,255,.018);
      overflow: hidden;
      transform: translateZ(0);
      transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease, filter .22s ease;
    }

    .hero-card--nitro:hover,
    .hero-card--nitro:focus-visible {
      transform: translateY(calc(var(--star-hero-hover-lift, 4px) * -1));
      border-color: color-mix(in oklch, var(--hero-accent, var(--c-primary)) var(--star-hero-hover-border-strength, 68%), var(--c-border));
      box-shadow: 0 18px 44px rgba(0,0,0,.36), 0 0 28px color-mix(in oklch, var(--hero-accent, var(--c-primary)) var(--star-hero-glow-strength, 22%), transparent), inset 0 1px 0 rgba(255,255,255,.07);
      outline: none;
    }

    .hero-card--nitro::before,
    .hero-card--nitro::after { content: ''; position: absolute; pointer-events: none; z-index: 3; }
    .hero-card--nitro::before {
      inset: var(--star-hero-frame-inset, 9px);
      border: 1px solid color-mix(in oklch, var(--hero-accent, var(--c-primary)) 22%, transparent);
      border-radius: var(--star-hero-frame-radius, 12px);
    }
    .hero-card--nitro::after {
      content: var(--hero-glyph, 'NITRO');
      right: 16px;
      top: 14px;
      font: 700 9px var(--font-mono);
      letter-spacing: 0;
      color: color-mix(in oklch, var(--hero-accent, var(--c-primary)) 62%, transparent);
      opacity: .58;
    }

    .hero-scene--nitro {
      position: relative;
      min-height: var(--star-hero-scene-height, 112px);
      overflow: hidden;
      background: radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--hero-accent, var(--c-primary)) 22%, transparent), transparent 34%), linear-gradient(180deg, rgba(255,255,255,.04), transparent 60%);
      border-bottom: 1px solid color-mix(in oklch, var(--hero-accent, var(--c-primary)) 20%, transparent);
    }

    .hsc-grid {
      position: absolute;
      inset: 0;
      opacity: var(--star-hero-grid-opacity, .42);
      background-image: linear-gradient(color-mix(in oklch, var(--hero-accent, var(--c-primary)) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--hero-accent, var(--c-primary)) 18%, transparent) 1px, transparent 1px);
      background-size: var(--star-hero-grid-size, 20px) var(--star-hero-grid-size, 20px);
      transform: perspective(420px) rotateX(58deg) translateY(18px) scale(1.15);
      transform-origin: bottom;
    }

    .nitro-hero-orb {
      position: absolute;
      left: 50%;
      top: 52%;
      width: var(--star-hero-orb-size, 76px);
      height: var(--star-hero-orb-size, 76px);
      transform: translate(-50%, -50%);
      display: grid;
      place-items: center;
      border-radius: var(--star-hero-orb-radius, 22px);
      border: 1px solid color-mix(in oklch, var(--hero-accent, var(--c-primary)) 62%, transparent);
      background: radial-gradient(circle at 35% 24%, rgba(255,255,255,.18), transparent 28%), color-mix(in oklch, var(--hero-accent, var(--c-primary)) var(--star-hero-accent-fill, 12%), rgba(5,8,14,.88));
      box-shadow: 0 0 24px color-mix(in oklch, var(--hero-accent, var(--c-primary)) var(--star-hero-orb-glow, 34%), transparent), inset 0 0 24px rgba(255,255,255,.035);
      font-size: var(--star-hero-orb-font-size, 34px);
      line-height: 1;
      animation: star-hero-float 4.2s ease-in-out infinite;
    }

    .nitro-hero-spark {
      position: absolute;
      width: var(--star-hero-spark-size, 5px);
      height: var(--star-hero-spark-size, 5px);
      border-radius: 50%;
      background: var(--hero-accent, var(--c-primary));
      box-shadow: 0 0 12px var(--hero-accent, var(--c-primary));
      opacity: .72;
    }
    .nitro-hero-spark-1 { left: 18%; top: 34%; animation: star-hero-blip 2.2s ease-in-out infinite; }
    .nitro-hero-spark-2 { right: 22%; top: 26%; animation: star-hero-blip 2.8s ease-in-out .4s infinite; }
    .nitro-hero-spark-3 { right: 18%; bottom: 24%; animation: star-hero-blip 2.4s ease-in-out .8s infinite; }

    .hero-card--nitro .hero-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: var(--star-hero-content-gap, 8px);
      padding: var(--star-hero-content-pad-y, 16px) var(--star-hero-content-pad-x, 17px) calc(var(--star-hero-content-pad-y, 16px) - 1px);
      text-align: left;
      animation: none;
    }
    .hero-card--nitro .hero-eyebrow { margin: 0; font: 600 9px var(--font-mono); letter-spacing: 0; color: color-mix(in oklch, var(--hero-accent, var(--c-primary)) 72%, var(--c-text-muted)); opacity: .86; }
    .hero-title--nitro { margin: 0; font-family: var(--font-display); font-size: var(--star-hero-title-size, 1.72rem); line-height: .88; letter-spacing: 0; color: var(--c-text); text-shadow: 0 0 18px color-mix(in oklch, var(--hero-accent, var(--c-primary)) var(--star-hero-title-glow, 28%), transparent); }
    .hero-title-accent { color: var(--hero-accent, var(--c-primary)); text-shadow: 0 0 18px color-mix(in oklch, var(--hero-accent, var(--c-primary)) 50%, transparent); }
    .hero-card--nitro .hero-sub { margin: 0; min-height: var(--star-hero-sub-min-height, 30px); font: 10px/1.35 var(--font-mono); letter-spacing: 0; color: var(--c-text-muted); }
    .hero-footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .hero-badge--nitro, .hero-cta { font: 700 9px var(--font-mono); letter-spacing: 0; white-space: nowrap; }
    .hero-badge--nitro { color: var(--hero-accent, var(--c-primary)); border: 1px solid color-mix(in oklch, var(--hero-accent, var(--c-primary)) 42%, transparent); background: color-mix(in oklch, var(--hero-accent, var(--c-primary)) 8%, transparent); border-radius: 999px; padding: 4px 8px; }
    .hero-cta { color: var(--c-text-faint); transition: color .2s, transform .2s; }
    .hero-card--nitro:hover .hero-cta { color: var(--hero-accent, var(--c-primary)); transform: translateX(2px); }
    .hero-scanlines { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: var(--star-hero-scanline-opacity, .16); background: repeating-linear-gradient(to bottom, transparent 0 3px, rgba(0,0,0,.65) 3px 4px); mix-blend-mode: multiply; }

    @keyframes star-hero-float { 0%,100% { transform: translate(-50%, -50%) translateY(0); } 50% { transform: translate(-50%, -50%) translateY(calc(var(--star-hero-hover-lift, 4px) * -1.25)); } }
    @keyframes star-hero-blip { 0%,100% { opacity: .22; transform: scale(.72); } 45% { opacity: .98; transform: scale(1.18); } }
    @media (max-width: 680px) { .bento-hero-row { grid-template-columns: 1fr; } .hero-card--nitro { min-height: max(200px, calc(var(--star-hero-min-height, 236px) - 20px)); grid-template-rows: min(var(--star-hero-scene-height, 112px), 104px) 1fr; } .hero-scene--nitro { min-height: min(var(--star-hero-scene-height, 112px), 104px); } .nitro-hero-orb { width: min(var(--star-hero-orb-size, 76px), 68px); height: min(var(--star-hero-orb-size, 76px), 68px); font-size: min(var(--star-hero-orb-font-size, 34px), 30px); border-radius: min(var(--star-hero-orb-radius, 22px), 20px); } }
  `;
  document.head.appendChild(style);
}
