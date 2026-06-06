export const SVG_ICON_MAP = {
  core: coreIcon,
  clickAmplifier: lightningIcon,
  autoCore: reactorIcon,
  autoClicker: autoClickerIcon,
  resonance: starResonanceIcon,
  surchargeCoil: helixIcon,
  prism: prismIcon,
  bioConduit: bioHeartIcon,
  fragmentCatalyst: fragmentIcon,
  nitroFactory: factoryIcon,
  enginePlant: gearPlantIcon,
  orbitalHive: orbitalHiveIcon,
  prestige: prestigeIcon,
  energy: energyIcon,
  fragment: fragmentIcon,
  milestoneOpen: diamondOpenIcon,
  milestoneDone: checkDiamondIcon,
  save: saveIcon,
  reset: warningIcon,
  star: starResonanceIcon,
  hub: hubArrowIcon,
  fx: fxIcon,
};

export function svgIcon(name, className = 'nc-svg-icon', title = '') {
  const fn = SVG_ICON_MAP[name] ?? coreIcon;
  return fn(className, title);
}

export function upgradeIcon(upgradeId, className = 'nc-svg-icon') {
  return svgIcon(upgradeId, className);
}

function wrap(className, title, body, viewBox = '0 0 64 64') {
  const aria = title ? `role="img" aria-label="${escapeAttr(title)}"` : 'aria-hidden="true"';
  const titleNode = title ? `<title>${escapeHtml(title)}</title>` : '';
  return `<svg class="${className}" ${aria} viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">${titleNode}${body}</svg>`;
}

function coreIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-glow" d="M32 5 55 18v28L32 59 9 46V18L32 5Z"/>
    <path class="svg-stroke" d="M32 5 55 18v28L32 59 9 46V18L32 5Z"/>
    <path class="svg-stroke thin" d="M32 14 47 22.5v19L32 50 17 41.5v-19L32 14Z"/>
    <circle class="svg-fill" cx="32" cy="32" r="7"/>
    <path class="svg-stroke thin" d="M32 14v11M47 22.5l-9.5 5.5M47 41.5 37.5 36M32 50V39M17 41.5l9.5-5.5M17 22.5l9.5 5.5"/>
  `);
}

function lightningIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-fill" d="M37 4 13 36h16l-4 24 27-36H35l2-20Z"/>
    <path class="svg-stroke" d="M37 4 13 36h16l-4 24 27-36H35l2-20Z"/>
  `);
}

function reactorIcon(className, title) {
  return wrap(className, title, `
    <circle class="svg-stroke" cx="32" cy="32" r="22"/>
    <circle class="svg-stroke thin" cx="32" cy="32" r="11"/>
    <circle class="svg-fill" cx="32" cy="32" r="4"/>
    <path class="svg-stroke" d="M32 10v10M32 44v10M10 32h10M44 32h10M16.5 16.5l7 7M40.5 40.5l7 7M47.5 16.5l-7 7M23.5 40.5l-7 7"/>
  `);
}

function autoClickerIcon(className, title) {
  return wrap(className, title, `
    <circle class="svg-stroke" cx="32" cy="32" r="21"/>
    <path class="svg-stroke" d="M32 14v8M32 42v8M14 32h8M42 32h8"/>
    <path class="svg-fill" d="M31 20a12 12 0 1 1-10 18l7-2a5 5 0 1 0 4-9l-1-7Z"/>
    <path class="svg-stroke thin" d="M23 20h12l-4 9M41 44H29l4-9"/>
    <circle class="svg-fill-alt" cx="32" cy="32" r="3"/>
  `);
}

function starResonanceIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-fill" d="m32 5 6.7 18.3L57 32l-18.3 8.7L32 59l-6.7-18.3L7 32l18.3-8.7L32 5Z"/>
    <path class="svg-stroke" d="m32 5 6.7 18.3L57 32l-18.3 8.7L32 59l-6.7-18.3L7 32l18.3-8.7L32 5Z"/>
    <circle class="svg-stroke thin" cx="32" cy="32" r="10"/>
  `);
}

function helixIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-stroke" d="M19 7c22 8 22 42 0 50M45 7c-22 8-22 42 0 50"/>
    <path class="svg-stroke thin" d="M22 16h20M19 26h26M19 38h26M22 48h20"/>
    <circle class="svg-fill" cx="19" cy="26" r="3"/><circle class="svg-fill" cx="45" cy="38" r="3"/>
  `);
}

function prismIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-fill" d="M32 5 56 32 32 59 8 32 32 5Z"/>
    <path class="svg-stroke" d="M32 5 56 32 32 59 8 32 32 5Z"/>
    <path class="svg-stroke thin" d="M32 5v54M8 32h48M20 18l24 28M44 18 20 46"/>
  `);
}

function bioHeartIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-fill" d="M32 57S10 43 10 24c0-8 6-14 14-14 4.5 0 7 2.5 8 5 1-2.5 3.5-5 8-5 8 0 14 6 14 14 0 19-22 33-22 33Z"/>
    <path class="svg-stroke" d="M32 57S10 43 10 24c0-8 6-14 14-14 4.5 0 7 2.5 8 5 1-2.5 3.5-5 8-5 8 0 14 6 14 14 0 19-22 33-22 33Z"/>
    <path class="svg-stroke thin" d="M20 30h8l4-9 5 18 3-9h5"/>
  `);
}

function fragmentIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-fill" d="M32 4 50 18 44 49 32 60 20 49 14 18 32 4Z"/>
    <path class="svg-stroke" d="M32 4 50 18 44 49 32 60 20 49 14 18 32 4Z"/>
    <path class="svg-stroke thin" d="M32 4v56M14 18h36M20 49l12-31 12 31"/>
  `);
}

function factoryIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-fill" d="M8 56V28l14 8V24l14 10V20l20 14v22H8Z"/>
    <path class="svg-stroke" d="M8 56V28l14 8V24l14 10V20l20 14v22H8Z"/>
    <path class="svg-stroke thin" d="M16 48h8M30 48h8M44 48h8M46 19V8h8v17"/>
  `);
}

function gearPlantIcon(className, title) {
  return wrap(className, title, `
    <circle class="svg-stroke" cx="32" cy="32" r="12"/>
    <circle class="svg-fill" cx="32" cy="32" r="4"/>
    <path class="svg-stroke" d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6"/>
    <path class="svg-stroke thin" d="M32 20c6 0 12 6 12 12"/>
  `);
}

function orbitalHiveIcon(className, title) {
  return wrap(className, title, `
    <circle class="svg-fill" cx="32" cy="32" r="8"/>
    <ellipse class="svg-stroke" cx="32" cy="32" rx="27" ry="11" transform="rotate(-18 32 32)"/>
    <ellipse class="svg-stroke thin" cx="32" cy="32" rx="27" ry="11" transform="rotate(48 32 32)"/>
    <path class="svg-stroke" d="M32 8v8M32 48v8"/>
    <circle class="svg-fill" cx="51" cy="21" r="3"/>
  `);
}

function prestigeIcon(className, title) {
  return wrap(className, title, `
    <path class="svg-stroke" d="M32 7a25 25 0 1 0 24 32"/>
    <path class="svg-fill" d="M55 17v18H37l7-7a16 16 0 1 1-12-5v-8c7 0 12 3 16 7l7-5Z"/>
    <path class="svg-stroke thin" d="M32 20v12l8 7"/>
  `);
}

function energyIcon(className, title) { return lightningIcon(className, title); }

function diamondOpenIcon(className, title) {
  return wrap(className, title, `<path class="svg-stroke" d="M32 7 57 32 32 57 7 32 32 7Z"/><path class="svg-stroke thin" d="M32 17 47 32 32 47 17 32 32 17Z"/>`);
}

function checkDiamondIcon(className, title) {
  return wrap(className, title, `<path class="svg-fill" d="M32 7 57 32 32 57 7 32 32 7Z"/><path class="svg-stroke" d="m20 32 8 8 17-19"/>`);
}

function saveIcon(className, title) {
  return wrap(className, title, `<path class="svg-stroke" d="M13 8h32l6 6v42H13V8Z"/><path class="svg-fill" d="M21 8h20v15H21V8Z"/><path class="svg-stroke thin" d="M22 56V38h20v18M27 16h8"/>`);
}

function warningIcon(className, title) {
  return wrap(className, title, `<path class="svg-fill" d="M32 7 59 55H5L32 7Z"/><path class="svg-stroke" d="M32 7 59 55H5L32 7Z"/><path class="svg-stroke thin" d="M32 23v16"/><circle class="svg-fill-alt" cx="32" cy="47" r="2.5"/>`);
}

function hubArrowIcon(className, title) {
  return wrap(className, title, `<path class="svg-stroke" d="M39 14 21 32l18 18"/><path class="svg-stroke thin" d="M23 32h33"/>`);
}

function fxIcon(className, title) {
  return wrap(className, title, `<path class="svg-fill" d="M18 8h28l-6 18h13L24 58l6-22H15L18 8Z"/><path class="svg-stroke" d="M18 8h28l-6 18h13L24 58l6-22H15L18 8Z"/>`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
