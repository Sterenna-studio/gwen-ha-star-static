/**
 * widgets.js — barrel de ré-export des widgets star/.
 * Le monolithe (1576 lignes) a été découpé en modules (voir widget-*.js).
 * Les imports existants `from './widgets.js'` restent valides et inchangés.
 */
export { SFX } from './widget-sfx.js';
export { VideoDay } from './widget-video-day.js';
export { probeRadioSite, RadioPlayer } from './widget-radio-player.js';
export { SlotMachine } from './widget-slot-machine.js';
