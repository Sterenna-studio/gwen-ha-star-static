import { createDefaultState, hydrateState, VERSION } from './clicker-state.js';

const LS_PREFIX = 'nitro-clicker.save.';
const MIGRATION_NOTICE_KEY = 'nitro-clicker.save.migration.notice';
const CURRENT_MIGRATION_ID = `save-v${VERSION}`;

export function localKey(userId) {
  return `${LS_PREFIX}${userId ?? 'guest'}`;
}

export function loadLocalSave(userId) {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[Nitro Clicker] local save load failed:', error);
    return null;
  }
}

export function saveLocal(userId, state) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('[Nitro Clicker] local save failed:', error);
    return false;
  }
}

export function loadSave(userId) {
  const local = loadLocalSave(userId);
  if (!local) return createDefaultState(userId);

  const { state, migrated, notice } = migrateLegacySave(local, userId);
  if (migrated) {
    saveLocal(userId, state);
    queueMigrationNotice(notice);
  }
  return state;
}

export function migrateLegacySave(raw, userId = null) {
  const rawVersion = Number(raw?.version ?? 0);
  const migrated = !rawVersion || rawVersion < VERSION || raw?.migration?.lastApplied !== CURRENT_MIGRATION_ID;
  const state = hydrateState(raw, userId);

  state.version = VERSION;
  state.migration = {
    ...(raw?.migration ?? {}),
    legacyDetected: rawVersion < VERSION,
    originalVersion: raw?.migration?.originalVersion ?? rawVersion,
    lastApplied: CURRENT_MIGRATION_ID,
    lastAppliedAt: Date.now(),
  };

  if (!migrated) return { state, migrated: false, notice: null };

  const shouldCompensate = raw?.migration?.compensationId !== CURRENT_MIGRATION_ID;
  const compensation = shouldCompensate ? computeMigrationCompensation(raw, rawVersion) : null;

  if (compensation) {
    state.energy += compensation.energy;
    state.totalEnergy += compensation.energy;
    state.fragments += compensation.fragments;
    state.totalFragments += compensation.fragments;
    state.migration.compensationId = CURRENT_MIGRATION_ID;
    state.migration.compensation = compensation;
  }

  state.migration.adapted = true;
  state.updatedAt = Date.now();

  return {
    state,
    migrated: true,
    notice: {
      fromVersion: rawVersion || 'legacy',
      toVersion: VERSION,
      compensated: !!compensation,
      compensation,
    },
  };
}

function computeMigrationCompensation(raw, rawVersion) {
  const totalEnergy = Math.max(0, Number(raw?.totalEnergy ?? raw?.energy ?? 0));
  const prestige = Math.max(0, Number(raw?.prestige ?? 0));
  const totalClicks = Math.max(0, Number(raw?.totalClicks ?? 0));
  const totalFragments = Math.max(0, Number(raw?.totalFragments ?? raw?.fragments ?? 0));
  const upgradeLevels = Object.values(raw?.upgrades ?? {}).reduce((sum, value) => sum + Math.max(0, Number(value ?? 0)), 0);

  const activityScore =
    Math.log10(Math.max(10, totalEnergy)) * 0.9 +
    Math.log10(Math.max(10, totalClicks)) * 0.45 +
    prestige * 1.4 +
    upgradeLevels * 0.18 +
    totalFragments * 0.08;

  const legacyBoost = rawVersion ? Math.max(0, VERSION - rawVersion) : 3;
  const fragments = Math.max(2, Math.min(80, Math.floor(activityScore + legacyBoost)));
  const energy = Math.max(1000, Math.min(5_000_000, Math.floor(Math.max(1, totalEnergy) * 0.08 + fragments * 850)));

  return {
    reason: 'Legacy save adapted to current balance/shell systems',
    energy,
    fragments,
    activityScore: Number(activityScore.toFixed(2)),
  };
}

function queueMigrationNotice(notice) {
  if (!notice) return;
  try {
    sessionStorage.setItem(MIGRATION_NOTICE_KEY, JSON.stringify(notice));
  } catch {}
}

export function readMigrationNotice() {
  try {
    const raw = sessionStorage.getItem(MIGRATION_NOTICE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(MIGRATION_NOTICE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAll(userId, state) {
  state.version = VERSION;
  return saveLocal(userId, state);
}

export function deleteLocalSave(userId) {
  localStorage.removeItem(localKey(userId));
}
