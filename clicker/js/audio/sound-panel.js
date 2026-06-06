import { SOUND_BANKS } from './sound-catalog.js';

let mounted = false;
let open = false;

function mountSoundPanel() {
  if (mounted) return true;
  const app = document.getElementById('app');
  const topActions = document.querySelector('.top-actions');
  if (!app || !topActions || !window.NitroSound) return false;

  if (!document.getElementById('sound-panel-toggle')) {
    topActions.insertAdjacentHTML('afterbegin', '<button class="nav-btn sound-panel-toggle" id="sound-panel-toggle" type="button">♪ SONS</button>');
  }

  app.insertAdjacentHTML('beforeend', `
    <aside class="sound-panel" id="sound-panel" aria-hidden="true">
      <header class="sound-panel-head">
        <div>
          <span>SOUND BOARD</span>
          <strong>NITRO AUDIO</strong>
        </div>
        <button type="button" id="sound-panel-close">×</button>
      </header>

      <section class="sound-master-row">
        <label class="sound-switch">
          <input type="checkbox" id="sound-enabled-toggle" />
          <span>Sons activés</span>
        </label>
        <label class="sound-volume-master">
          <span>Master</span>
          <input type="range" id="sound-master-volume" min="0" max="1" step="0.01" />
        </label>
      </section>

      <div class="sound-panel-note">
        Chaque son est nommé avec un identifiant stable. Tu peux remplacer plus tard un son par fichier dans <code>js/audio/sound-catalog.js</code> avec <code>src</code>.
      </div>

      <div class="sound-bank-list">
        ${SOUND_BANKS.map(bank => `
          <section class="sound-bank" data-bank="${bank.id}">
            <header><strong>${bank.label}</strong><small>${bank.id}</small></header>
            <div class="sound-list">
              ${bank.sounds.map(sound => `
                <article class="sound-row" data-sound-row="${sound.id}">
                  <div class="sound-row-main">
                    <strong>${sound.label}</strong>
                    <code>${sound.id}</code>
                    <p>${sound.description}</p>
                  </div>
                  <div class="sound-row-controls">
                    <button type="button" data-sound-preview="${sound.id}">TEST</button>
                    <label><span>Vol</span><input type="range" min="0" max="1" step="0.01" data-sound-volume="${sound.id}" /></label>
                    <label class="sound-mini-switch"><input type="checkbox" data-sound-mute="${sound.id}" /><span>Mute</span></label>
                  </div>
                </article>
              `).join('')}
            </div>
          </section>
        `).join('')}
      </div>

      <footer class="sound-panel-footer">
        <button type="button" id="sound-reset-all">RESET SONS</button>
      </footer>
    </aside>
  `);

  bindSoundPanel();
  syncSoundPanel();
  mounted = true;
  return true;
}

function bindSoundPanel() {
  document.getElementById('sound-panel-toggle')?.addEventListener('click', () => setOpen(!open));
  document.getElementById('sound-panel-close')?.addEventListener('click', () => setOpen(false));
  document.getElementById('sound-enabled-toggle')?.addEventListener('change', event => {
    window.NitroSound.setEnabled(event.currentTarget.checked);
    syncSoundPanel();
  });
  document.getElementById('sound-master-volume')?.addEventListener('input', event => {
    window.NitroSound.setMasterVolume(event.currentTarget.value);
  });
  document.getElementById('sound-reset-all')?.addEventListener('click', () => {
    window.NitroSound.resetAll();
    syncSoundPanel();
  });

  document.querySelectorAll('[data-sound-preview]').forEach(button => {
    button.addEventListener('click', () => window.NitroSound.play(button.dataset.soundPreview, { volume: 1 }));
  });

  document.querySelectorAll('[data-sound-volume]').forEach(input => {
    input.addEventListener('input', () => window.NitroSound.setSoundVolume(input.dataset.soundVolume, input.value));
  });

  document.querySelectorAll('[data-sound-mute]').forEach(input => {
    input.addEventListener('change', () => window.NitroSound.setSoundMuted(input.dataset.soundMute, input.checked));
  });

  window.addEventListener('nitro:sound-settings-changed', syncSoundPanel);
}

function syncSoundPanel() {
  const settings = window.NitroSound?.settings?.();
  if (!settings) return;
  const enabled = document.getElementById('sound-enabled-toggle');
  const master = document.getElementById('sound-master-volume');
  if (enabled) enabled.checked = !!settings.enabled;
  if (master) master.value = String(settings.masterVolume ?? 0.75);

  for (const sound of window.NitroSound.sounds()) {
    const vol = document.querySelector(`[data-sound-volume="${sound.id}"]`);
    const mute = document.querySelector(`[data-sound-mute="${sound.id}"]`);
    if (vol) vol.value = String(settings.volumes?.[sound.id] ?? sound.volume ?? 1);
    if (mute) mute.checked = !!settings.mutedSounds?.[sound.id];
  }
}

function setOpen(value) {
  open = !!value;
  const panel = document.getElementById('sound-panel');
  const btn = document.getElementById('sound-panel-toggle');
  panel?.classList.toggle('open', open);
  panel?.setAttribute('aria-hidden', String(!open));
  btn?.classList.toggle('active', open);
}

const boot = setInterval(() => {
  if (mountSoundPanel()) clearInterval(boot);
}, 250);

window.NitroSoundPanel = { open: () => setOpen(true), close: () => setOpen(false), sync: syncSoundPanel };
