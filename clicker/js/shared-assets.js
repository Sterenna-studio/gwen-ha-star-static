import { applyCssImageVar, resolveImage as resolveCachedImage } from './ui/asset-cache.js';

const SHARED_BASE = '/shared';

const SHARED_ASSETS = {
  starLogo: [
    `${SHARED_BASE}/logos/star_logo/star_logo_color_set/star_logo_white_silver.png`,
    `${SHARED_BASE}/logos/star_logo/star_logo_color_set/star_logo_cyan_magenta.png`,
    `${SHARED_BASE}/logos/star_logo/star_logo.png`,
  ],
};

let resolvedStarLogo = null;
let resolvingStarLogo = null;
let lastFavicon = '';

function resolveImage(candidates, key = candidates.join('|')) {
  return resolveCachedImage(candidates, key);
}

function setImage(node, src) {
  if (!node || !src) return;
  applyCssImageVar(node, '--shared-star-logo', src);
  node.dataset.sharedAssetReady = 'true';
}

function ensureSharedAssetNodes() {
  const shell = document.querySelector('.clicker-shell');
  const corePanel = document.getElementById('core-panel');
  const clickCore = document.getElementById('click-core');
  const brandTitle = document.querySelector('.brand-title');
  if (!shell || !corePanel || !clickCore || !brandTitle) return false;

  if (!document.getElementById('shared-brand-mark')) {
    brandTitle.insertAdjacentHTML('beforebegin', '<div class="shared-brand-mark shared-asset-node" id="shared-brand-mark" aria-hidden="true"></div>');
  }

  if (!document.getElementById('shared-reactor-watermark')) {
    corePanel.insertAdjacentHTML('afterbegin', '<div class="shared-reactor-watermark shared-asset-node" id="shared-reactor-watermark" aria-hidden="true"></div>');
  }

  if (!document.getElementById('shared-bg-sigil')) {
    shell.insertAdjacentHTML('afterbegin', '<div class="shared-bg-sigil shared-asset-node" id="shared-bg-sigil" aria-hidden="true"></div>');
  }

  if (!document.getElementById('shared-core-center-asset')) {
    clickCore.insertAdjacentHTML('beforeend', '<span class="shared-core-center-asset shared-asset-node" id="shared-core-center-asset" aria-hidden="true"></span>');
  }

  return true;
}

function applyResolvedAssets(src) {
  if (!src) return;
  applyCssImageVar(document.documentElement, '--shared-star-logo', src);
  setImage(document.getElementById('shared-brand-mark'), src);
  setImage(document.getElementById('shared-reactor-watermark'), src);
  setImage(document.getElementById('shared-bg-sigil'), src);
  setImage(document.getElementById('shared-core-center-asset'), src);
  updateFavicon(src);
}

function mountSharedAssets() {
  if (!ensureSharedAssetNodes()) return false;

  if (resolvedStarLogo) {
    applyResolvedAssets(resolvedStarLogo);
    return true;
  }

  if (!resolvingStarLogo) {
    resolvingStarLogo = resolveImage(SHARED_ASSETS.starLogo, 'starLogo').then(src => {
      resolvedStarLogo = src;
      applyResolvedAssets(src);
      return src;
    });
  }

  resolvingStarLogo.then(applyResolvedAssets);
  return true;
}

function updateFavicon(src) {
  if (!src || lastFavicon === src) return;
  lastFavicon = src;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = src;
  link.type = 'image/png';
}

const boot = setInterval(() => {
  if (mountSharedAssets()) clearInterval(boot);
}, 250);

window.addEventListener('nitro:ui-remounted', mountSharedAssets);
window.addEventListener('nitro:upgrade-bought', mountSharedAssets);
window.addEventListener('nitro:prestige-done', mountSharedAssets);

window.NitroSharedAssets = {
  base: SHARED_BASE,
  assets: SHARED_ASSETS,
  resolveImage,
  mount: mountSharedAssets,
};
