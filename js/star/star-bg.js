/**
 * star-bg.js — Fond étoilé animé (canvas) pour star/index.html
 * 220 particules : drift lent, scintillement, nébuleuse cyan/purple
 */
export function initStarBackground() {
  const canvas = document.createElement('canvas');
  canvas.id = 'star-bg-canvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let W, H, stars = [];
  const STAR_COUNT = 220;
  const HUES = [0, 0, 180, 200, 260]; // blanc dominant + touches cyan/violet

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
      vy: (Math.random() - 0.5) * 0.045,
      a:  Math.random(),
      da: (Math.random() * 0.006 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
      h:  HUES[Math.floor(Math.random() * HUES.length)],
      s:  Math.random() > 0.7 ? 70 : 15, // majorité blanche, quelques colorées
    };
  }

  function init() {
    resize();
    stars = Array.from({ length: STAR_COUNT }, mkStar);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Nébuleuse radiale centrale
    const g1 = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, W * 0.52);
    g1.addColorStop(0,   'rgba(25, 35, 110, 0.20)');
    g1.addColorStop(0.4, 'rgba(70, 15,  95, 0.09)');
    g1.addColorStop(1,   'rgba(0,  0,   0,  0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    // Deuxième tache nébuleuse décalée (accent cyan)
    const g2 = ctx.createRadialGradient(W * 0.72, H * 0.62, 0, W * 0.72, H * 0.62, W * 0.3);
    g2.addColorStop(0,   'rgba(0, 180, 200, 0.07)');
    g2.addColorStop(1,   'rgba(0,   0,   0, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // Étoiles
    for (const s of stars) {
      s.x += s.vx;
      s.y += s.vy;
      s.a += s.da;
      if (s.a > 1)  s.da = -Math.abs(s.da);
      if (s.a < 0)  s.da =  Math.abs(s.da);
      if (s.x < -2) s.x = W + 2;
      if (s.x > W + 2) s.x = -2;
      if (s.y < -2) s.y = H + 2;
      if (s.y > H + 2) s.y = -2;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.a)) * 0.9;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${s.h}, ${s.s}%, 92%)`;
      ctx.fill();
      // Halo léger pour les grosses étoiles
      if (s.r > 0.9) {
        ctx.globalAlpha *= 0.18;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${s.h}, ${s.s + 20}%, 85%)`;
        ctx.fill();
      }
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
}
