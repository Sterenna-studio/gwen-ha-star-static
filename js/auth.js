/**
 * Compatibility wrapper for the public header auth widget.
 * Shared Nitro session UI now lives in /shared/session-ui.js.
 */

import { mountSessionWidget } from '../shared/session-ui.js';
import { renderPublicNitroApps } from './hub/nitro-public-renderer.js';

export async function initAuth() {
  await mountSessionWidget('header-auth', {
    loginUrl: '/login.html',
    spaceUrl: '/star/',
    spaceLabel: '⬡ MON ESPACE',
  });

  renderPublicNitroApps();
}
