import { VideoDay } from './widgets.js';

export async function loadVideo() {
  const widget = new VideoDay('widget-video');
  await widget.load();
}
