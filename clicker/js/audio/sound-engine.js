import { flattenSoundCatalog, getSoundDefinition, SOUND_BANKS } from './sound-catalog.js';

const SETTINGS_KEY = 'nitro-clicker.sound.settings.v1';
const DEFAULT_SETTINGS = {
  enabled: true,
  masterVolume: 0.75,
  mutedSounds: {},
  volumes: {},
};

let audioCtx = null;
let settings = loadSettings();

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('nitro:sound-settings-changed', { detail: getSettings() }));
}

function ctx() {
  if (!settings.enabled) return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSound(id, options = {}) {
  if (!settings.enabled || settings.mutedSounds?.[id]) return false;
  const sound = getSoundDefinition(id);
  if (!sound) return false;

  if (sound.src) {
    playFile(sound, options);
    return true;
  }

  const context = ctx();
  if (!context) return false;
  const soundVolume = settings.volumes?.[id] ?? sound.volume ?? 1;
  const volume = clamp01((options.volume ?? 1) * settings.masterVolume * soundVolume);
  const now = context.currentTime;

  for (const step of sound.synth ?? []) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.type = step.type ?? 'sine';
    const detune = Number(step.detune ?? 0);
    const freq = Number(step.freq ?? 440) + (detune ? (Math.random() * 2 - 1) * detune : 0);
    const start = now + Number(step.delay ?? 0);
    const dur = Number(step.dur ?? 0.08);
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * Number(step.gain ?? 0.04), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  return true;
}

function playFile(sound, options = {}) {
  const audio = new Audio(sound.src);
  audio.volume = clamp01((options.volume ?? 1) * settings.masterVolume * (settings.volumes?.[sound.id] ?? sound.volume ?? 1));
  audio.play().catch(() => {});
}

function setEnabled(enabled) {
  settings.enabled = !!enabled;
  saveSettings();
}

function setMasterVolume(value) {
  settings.masterVolume = clamp01(Number(value));
  saveSettings();
}

function setSoundVolume(id, value) {
  settings.volumes = { ...(settings.volumes ?? {}), [id]: clamp01(Number(value)) };
  saveSettings();
}

function setSoundMuted(id, muted) {
  settings.mutedSounds = { ...(settings.mutedSounds ?? {}), [id]: !!muted };
  saveSettings();
}

function resetSound(id) {
  const { [id]: _v, ...volumes } = settings.volumes ?? {};
  const { [id]: _m, ...mutedSounds } = settings.mutedSounds ?? {};
  settings.volumes = volumes;
  settings.mutedSounds = mutedSounds;
  saveSettings();
}

function resetAll() {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
}

function getSettings() {
  return JSON.parse(JSON.stringify(settings));
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

window.NitroSound = {
  banks: SOUND_BANKS,
  sounds: flattenSoundCatalog,
  play: playSound,
  get: getSoundDefinition,
  settings: getSettings,
  setEnabled,
  setMasterVolume,
  setSoundVolume,
  setSoundMuted,
  resetSound,
  resetAll,
};
