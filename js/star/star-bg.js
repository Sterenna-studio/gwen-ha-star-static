/**
 * star-bg.js — Fond étoilé animé pour star/index.html
 * Canvas fixe, 220 particules, nébuleuse centrale, scintillement.
 */
export function initStarBackground() {
  const canvas = document.createElement('canvas');
  canvas.id = 'star-bg-canvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let W, H, stars = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkStar() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  Math.random() * 1.3 + 0.15,
      vx: (Math.random() - 0.5) * 0.07,
      vy: (Math.random() - 0.5) * 0.05,
      a:  Math.random(),
      da: (Math.random() * 0.004 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
      h:  [0, 180, 200, 210, 260][Math.floor(Math.random() * 5)],
    };
  }

  function init() {
    resize();
    stars = Array.from({ length: 220 }, mkStar);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* nébuleuse radiale centrale */
    const g = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.55);
    g.addColorStop(0,   'rgba(22, 30, 110, 0.20)');
    g.addColorStop(0.4, 'rgba(70, 18,  95, 0.10)');
    g.addColorStop(1,   'rgba(0,  0,   0,  0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* second reflet — bas de page, violet chaud */
    const g2 = ctx.createRadialGradient(W * 0.8, H * 0.85, 0, W * 0.8, H * 0.85, W * 0.3);
    g2.addColorStop(0,   'rgba(90, 20, 130, 0.10)');
    g2.addColorStop(1,   'rgba(0,  0,   0,  0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      s.x += s.vx;
      s.y += s.vy;
      s.a += s.da;
      if (s.a > 1)  { s.da = -Math.abs(s.da); }
      if (s.a < 0)  { s.da =  Math.abs(s.da); }
      if (s.x < 0)  { s.x = W; }
      if (s.x > W)  { s.x = 0; }
      if (s.y < 0)  { s.y = H; }
      if (s.y > H)  { s.y = 0; }

      ctx.save();
      ctx.globalAlpha = s.a * 0.88;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${s.h}, 75%, 92%)`;
      ctx.fill();
      /* halo doux sur les grosses étoiles */
      if (s.r > 0.9) {
        ctx.globalAlpha = s.a * 0.18;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${s.h}, 80%, 80%)`;
        ctx.fill();
      }
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    resize();
    /* reposition les étoiles hors écran */
    for (const s of stars) {
      s.x = Math.min(s.x, W);
      s.y = Math.min(s.y, H);
    }
  });

  init();
  draw();
}
