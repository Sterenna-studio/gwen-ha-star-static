import { VideoDay } from './widgets.js';

const STAR_VIDEO_RECOMMENDATION = {
  title: 'RECO VIDEO · GWEN HA STAR',
  url: 'https://youtu.be/4wfuK_AbZiQ?list=LL',
  platform: 'youtube',
  note: 'Sélection cockpit',
};

export async function loadVideo() {
  const widget = new VideoDay('widget-video', {
    preferredContent: STAR_VIDEO_RECOMMENDATION,
  });
  await widget.load();
}
