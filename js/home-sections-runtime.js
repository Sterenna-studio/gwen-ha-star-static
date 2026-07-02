const home = document.querySelector('.hub-hero');
if (home) groupHomeSections();

function groupHomeSections(){
  const main = document.querySelector('main');
  if(!main) return;
  document.body.classList.add('home-sections-runtime');

  const sections = [...main.querySelectorAll(':scope > section.hub-section')];
  const byLabel = text => sections.find(section => section.textContent.includes(text));
  const twitch = byLabel('STREAM LIVE');
  const youtube = byLabel('CHAÎNE');
  const webRadio = document.getElementById('web-radio');
  const jukebox = document.getElementById('jukebox');
  const chronicles = document.getElementById('chronicles-fm');

  [...document.querySelectorAll('.hub-divider')].forEach(el => el.classList.add('home-hidden'));
  [...document.querySelectorAll('a[href="#jukebox"],a[href="#chronicles-fm"]')].forEach(el => el.classList.add('home-hidden'));
  if(jukebox) jukebox.classList.add('home-hidden');
  if(chronicles) chronicles.classList.add('home-hidden');

  if(twitch){
    setSectionTitle(twitch, '// 02 · LIVE & VIDÉO', 'Twitch + YouTube');
    twitch.classList.add('home-live-video-section');
  }

  if(twitch && youtube){
    const ytLayout = youtube.querySelector('.yt-layout');
    if(ytLayout){
      const block = document.createElement('div');
      block.className = 'home-youtube-merged';
      block.appendChild(ytLayout);
      twitch.appendChild(block);
    }
    youtube.classList.add('home-hidden');
  }

  if(webRadio){
    setSectionTitle(webRadio, '// 03 · WEB RADIO · YOUTUBE', 'Chronicles FM');
    webRadio.classList.add('home-radio-section');
    if(twitch) twitch.insertAdjacentElement('afterend', webRadio);
  }
}

function setSectionTitle(section, label, title){
  const labelEl = section.querySelector('.hub-section-label');
  const titleEl = section.querySelector('.hub-section-title');
  if(labelEl) labelEl.textContent = label;
  if(titleEl) titleEl.textContent = title;
}

const style = document.createElement('style');
style.textContent = `
.home-sections-runtime .home-hidden{display:none!important}
.home-sections-runtime .home-live-video-section{padding-bottom:var(--space-6)}
.home-sections-runtime .home-youtube-merged{margin-top:var(--space-7);padding-top:var(--space-6);border-top:1px solid var(--c-divider)}
.home-sections-runtime .home-radio-section{padding-top:0}
.home-sections-runtime .home-radio-section .radio-hub-card{max-width:900px}
`;
document.head.appendChild(style);
