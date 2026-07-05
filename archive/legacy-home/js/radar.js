
export function initRadar(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H, cx, cy, R, angle = 0;
  const dots = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    cx = W / 2; cy = H / 2;
    R  = Math.min(W, H) * 0.42;
  }

  function spawnDot() {
    if (dots.length > 18) return;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * R * 0.85;
    dots.push({ a, r, life: 1, decay: 0.008 + Math.random() * 0.006 });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // -- theme aware colours
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const primary    = isDark ? "rgba(123,92,240," : "rgba(91,63,208,";
    const greenCol   = isDark ? "rgba(0,255,136,"  : "rgba(0,168,85,";
    const textFaint  = isDark ? "rgba(200,184,255,0.12)" : "rgba(26,16,64,0.1)";
    const bg         = isDark ? "rgba(3,5,15,"     : "rgba(240,242,255,";

    // circles
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2);
      ctx.strokeStyle = textFaint;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    }
    // cross hairs
    ctx.strokeStyle = textFaint;
    ctx.lineWidth   = 0.6;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

    // sweep
    const grad = ctx.createConicalGradient
      ? null
      : null;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const sweep = ctx.createLinearGradient(0, -R, 0, R);
    sweep.addColorStop(0,    primary + "0)");
    sweep.addColorStop(0.55, primary + "0)");
    sweep.addColorStop(1,    primary + "0.25)");
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 0.8);
    ctx.closePath();
    ctx.fillStyle = sweep;
    ctx.fill();
    // sweep line
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -R);
    ctx.strokeStyle = primary + "0.7)";
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    // dots
    dots.forEach((d, i) => {
      d.life -= d.decay;
      if (d.life <= 0) { dots.splice(i, 1); return; }
      const dx = cx + Math.cos(d.a) * d.r;
      const dy = cy + Math.sin(d.a) * d.r;
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fillStyle = greenCol + (d.life * 0.9) + ")";
      ctx.shadowBlur  = 8;
      ctx.shadowColor = greenCol + "0.6)";
      ctx.fill();
      ctx.shadowBlur  = 0;
    });

    angle += 0.012;
    if (Math.random() < 0.03) spawnDot();
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
}
