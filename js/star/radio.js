import { RadioPlayer } from './widgets.js';

export function loadRadio(user, profile) {
  const radio = new RadioPlayer('widget-radio', {
    userId: user?.id ?? null,
    username: profile?.username ?? user?.email?.split('@')[0] ?? 'AGENT',
  });
  radio.render();
}
