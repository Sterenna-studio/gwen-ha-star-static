(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const el = {
    best: document.getElementById("bestDistance"),
    coins: document.getElementById("coins"),
    shop: document.getElementById("shop"),
    msg: document.getElementById("message"),
    speedMeter: document.getElementById("speedMeter"),
    speedText: document.getElementById("speedText"),
    timingMeter: document.getElementById("timingMeter"),
    timingText: document.getElementById("timingText"),
    rocketMeter: document.getElementById("rocketMeter"),
    rocketText: document.getElementById("rocketText"),
    resetSave: document.getElementById("resetSave"),
  };

  const upgrades = {
    shoes:      { name: "Chaussures",       desc: "Plus d'accélération quand tu spammes.",             base: 40, max: 8 },
    ramp:       { name: "Rampe",            desc: "Zone de saut plus large et meilleur angle.",         base: 55, max: 8 },
    rocket:     { name: "Rocket",           desc: "Boost utilisable en plein vol avec ta touche rocket.", base: 70, max: 8 },
    cape:       { name: "Cape aéro",        desc: "Titan perd moins de vitesse en l'air.",              base: 45, max: 8 },
    start:      { name: "Ligne de départ",  desc: "Bonus de vitesse initiale.",                         base: 35, max: 8 },
    doubleJump:  { name: "Double Saut",        desc: "Touche saut en vol = second envol. Niv.5 = 2 charges.",             base: 90, max: 5 },
    rubberBoots: { name: "Bottes caoutchouc",  desc: "Titan rebondit à l'atterrissage. Niv.+ = rebonds plus hauts/nombreux.", base: 75, max: 6 },
  };

  const defaultSave = {
    coins: 0,
    best: 0,
    upgrades: { shoes: 0, ramp: 0, rocket: 0, cape: 0, start: 0, doubleJump: 0, rubberBoots: 0 }
  };

  let save = loadSave();
  const anim = {};
  const keys = new Set();
  let last = performance.now();
  let time = 0;
  let particles = [];
  let pickups   = [];
  let obstacles = [];
  let springs   = [];
  let floats    = [];
  let state = "ready";
  let runInput = { lastKey: null, combo: 0, spamHeat: 0 };
  let attempt = {};
  let cameraX = 0;
  let cameraY = 0;

  const config = {
    groundY: 575,
    startX: 120,
    rampX: 850,
    rampW: 150,
    rampH: 58,
    worldScale: 0.09, // px to meters-ish
  };

  const defaultKeys = { runLeft: 'a', runRight: 'd', jump: ' ', rocket: 'shift', restart: 'r' };

  function loadKeys() {
    try {
      const raw = localStorage.getItem('titanRocketRunKeys');
      if (!raw) return { ...defaultKeys };
      return { ...defaultKeys, ...JSON.parse(raw) };
    } catch { return { ...defaultKeys }; }
  }
  function saveKeys() {
    localStorage.setItem('titanRocketRunKeys', JSON.stringify(keybinds));
  }

  let keybinds = loadKeys();
  let listeningFor = null;

  // Deterministic star field — stable across frames
  const STARS = (() => {
    const arr = [];
    for (let i = 0; i < 72; i++) arr.push({
      x: (i * 347 + 83) % W,
      y: (i * 271 + 51) % Math.round(config.groundY * 0.60),
      r: 0.5 + (i * 13 % 12) * 0.10,
      a: 0.22 + (i * 23 % 10) * 0.05,
    });
    return arr;
  })();

  const titan = {
    x: config.startX,
    y: config.groundY,
    vx: 0,
    vy: 0,
    facing: 1,
    anim: "idle",
    frame: 0,
    frameT: 0,
    scale: 0.22,
    grounded: true,
    rotation: 0,
  };

  async function loadAssets() {
    const res = await fetch("assets/titan_manifest.json");
    const manifest = await res.json();

    const jobs = [];
    for (const [name, data] of Object.entries(manifest.animations)) {
      anim[name] = { fps: data.fps, loop: data.loop, frames: [] };
      for (const src of data.frames) {
        jobs.push(loadImage(src).then(img => anim[name].frames.push(img)));
      }
    }
    await Promise.all(jobs);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem("titanRocketRunSave");
      if (!raw) return structuredClone(defaultSave);
      const parsed = JSON.parse(raw);
      const base = structuredClone(defaultSave);
      if (parsed.coins != null) base.coins = parsed.coins;
      if (parsed.best  != null) base.best  = parsed.best;
      if (parsed.upgrades) Object.assign(base.upgrades, parsed.upgrades);
      return base;
    } catch {
      return structuredClone(defaultSave);
    }
  }

  function writeSave() {
    localStorage.setItem("titanRocketRunSave", JSON.stringify(save));
    updateUI();
  }

  function upgradeCost(id) {
    const u = upgrades[id];
    const lvl = save.upgrades[id] || 0;
    return Math.floor(u.base * Math.pow(1.55, lvl));
  }

  function updateUI() {
    el.best.textContent = `${save.best.toFixed(1)} m`;
    el.coins.textContent = save.coins;
    renderShop();
    renderControls();
  }

  function renderShop() {
    el.shop.innerHTML = "";
    Object.entries(upgrades).forEach(([id, u]) => {
      const lvl = save.upgrades[id] || 0;
      const cost = upgradeCost(id);
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="itemTop">
          <div>
            <h3>${u.name}</h3>
            <small>${u.desc}</small>
          </div>
          <b>Niv. ${lvl}/${u.max}</b>
        </div>
        <button ${lvl >= u.max || save.coins < cost ? "disabled" : ""}>
          ${lvl >= u.max ? "MAX" : `Acheter — ${cost} os`}
        </button>`;
      div.querySelector("button").onclick = () => {
        if (save.coins >= cost && lvl < u.max) {
          save.coins -= cost;
          save.upgrades[id] = lvl + 1;
          writeSave();
          message("Upgrade acheté", `${u.name} niveau ${lvl + 1}.`);
        }
      };
      el.shop.appendChild(div);
    });
  }

  function resetAttempt() {
    Object.assign(titan, {
      x: config.startX, y: config.groundY, vx: 60 + save.upgrades.start * 12,
      vy: 0, anim: "idle", frame: 0, frameT: 0, grounded: true, rotation: 0,
    });
    cameraX = 0;
    particles = [];
    pickups   = [];
    obstacles = [];
    springs   = [];
    floats    = [];
    runInput = { lastKey: null, combo: 0, spamHeat: 0 };
    state = "ready";
    attempt = {
      maxSpeed: 0,
      jumpQuality: 0,
      jumped: false,
      landed: false,
      rocket: 55 + save.upgrades.rocket * 16,
      rocketUsed: 0,
      distance: 0,
      reward: 0,
      bonusCoins: 0,
      doubleJumpsUsed: 0,
      bounces: 0,
    };
    message("Prêt ?", `Alterne ${keyLabel(keybinds.runLeft)} / ${keyLabel(keybinds.runRight)} pour courir. Appuie sur ${keyLabel(keybinds.jump)} dans la zone verte.`);
  }

  function message(title, body) {
    el.msg.innerHTML = `<b>${title}</b><br>${body}`;
  }

  function keyLabel(k) {
    const MAP = { ' ': 'Espace', 'shift': 'Shift', 'control': 'Ctrl', 'alt': 'Alt',
      'arrowleft': '←', 'arrowright': '→', 'arrowup': '↑', 'arrowdown': '↓', 'escape': 'Échap' };
    return MAP[k] ?? k.toUpperCase();
  }

  function renderControls() {
    const panel = document.getElementById('controls-panel');
    if (!panel) return;
    const defs = [
      { id: 'runLeft',  label: 'Courir ←' },
      { id: 'runRight', label: 'Courir →' },
      { id: 'jump',     label: 'Sauter' },
      { id: 'rocket',   label: 'Booster' },
      { id: 'restart',  label: 'Relancer' },
    ];
    panel.innerHTML = '';
    defs.forEach(({ id, label }) => {
      const row = document.createElement('div');
      row.className = 'ctrl-row';
      const lbl = document.createElement('span');
      lbl.className = 'ctrl-label';
      lbl.textContent = label;
      const btn = document.createElement('button');
      btn.className = 'ctrl-key' + (listeningFor === id ? ' listening' : '');
      btn.textContent = listeningFor === id ? '…' : keyLabel(keybinds[id]);
      btn.onclick = () => { listeningFor = id; renderControls(); };
      row.appendChild(lbl);
      row.appendChild(btn);
      panel.appendChild(row);
    });
    const hint = document.createElement('p');
    hint.className = 'ctrl-hint';
    hint.textContent = listeningFor ? 'Appuie sur une touche (Échap = annuler)' : 'Cliquer une touche pour rebinder';
    panel.appendChild(hint);
  }

  function doDoubleJump() {
    attempt.doubleJumpsUsed++;
    const power = 320 + save.upgrades.doubleJump * 50;
    titan.vy = -power;
    titan.vx *= 1.04 + save.upgrades.doubleJump * 0.015;
    titan.anim = 'jump';
    titan.frame = 0;
    burst(titan.x, titan.y - 65, 18);
    floats.push({ x: titan.x, y: titan.y - 90, text: 'DOUBLE SAUT !', life: 1.1, max: 1.1, vy: -55, color: '#62ff52' });
  }

  function startRun() {
    if (state === "ready") {
      state = "runup";
      titan.anim = "run";
      message("Cours !", `Alterne ${keyLabel(keybinds.runLeft)} / ${keyLabel(keybinds.runRight)} vite, puis ${keyLabel(keybinds.jump)} sur la rampe.`);
    }
  }

  function tryJump() {
    if (state !== "runup") return;
    const rampStart = config.rampX - (70 + save.upgrades.ramp * 7);
    const rampEnd = config.rampX + config.rampW + (70 + save.upgrades.ramp * 7);
    const center = config.rampX + config.rampW * 0.55;
    const dist = Math.abs(titan.x - center);
    const window = Math.max(55, (rampEnd - rampStart) * 0.45);
    const quality = Math.max(0, 1 - dist / window);

    attempt.jumpQuality = quality;
    attempt.jumped = true;
    state = "flight";
    spawnFlightObjects();
    titan.grounded = false;
    titan.anim = "jump";
    titan.vy = -(520 + save.upgrades.ramp * 28 + quality * 260);
    titan.vx *= 0.92 + quality * 0.22;
    titan.y -= 8;

    burst(titan.x, titan.y - 40, quality > .75 ? 30 : 12);
    if (quality > .85) message("Timing parfait !", "Titan prend son envol comme une fusée verte.");
    else if (quality > .45) message("Bon saut", "Pas mal, mais tu peux gratter plus de distance.");
    else message("Saut faible", "Trop tôt ou trop tard : vise la zone verte.");
  }

  function doRocket(dt) {
    if (state !== "flight" || titan.grounded || attempt.rocket <= 0) return;
    const power = 520 + save.upgrades.rocket * 45;
    titan.vx += power * dt;
    titan.vy -= (80 + save.upgrades.rocket * 12) * dt;
    attempt.rocket -= 44 * dt;
    attempt.rocketUsed += 44 * dt;
    titan.anim = "bark_energy_blast";
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: titan.x - 55 + Math.random() * 20,
        y: titan.y - 60 + Math.random() * 50,
        vx: -220 - Math.random() * 260,
        vy: -40 + Math.random() * 80,
        life: .35 + Math.random() * .25,
        max: .55,
        r: 5 + Math.random() * 11,
        color: `rgba(${90 + Math.random()*90},255,80,`,
        z: 1,
      });
    }
  }

  function finishRun() {
    if (attempt.landed) return;
    attempt.landed = true;
    state = "result";
    titan.anim = "sit_rest";
    const dist = Math.max(0, (titan.x - config.startX) * config.worldScale);
    attempt.distance = dist;
    const baseReward = Math.max(1, Math.floor(dist * 0.8 + attempt.maxSpeed * 0.02 + attempt.jumpQuality * 20));
    attempt.reward = baseReward + attempt.bonusCoins;
    save.coins += attempt.reward;
    if (dist > save.best) save.best = dist;
    writeSave();
    const bonusPart  = attempt.bonusCoins > 0 ? ` (+${attempt.bonusCoins} ramassés)` : '';
    const bouncePart = attempt.bounces   > 0 ? ` · ${attempt.bounces} rebond${attempt.bounces > 1 ? 's' : ''}` : '';
    message(
      `${dist.toFixed(1)} m !`,
      `+${attempt.reward} os${bonusPart}${bouncePart}. Appuie sur ${keyLabel(keybinds.restart)} pour relancer.`
    );
  }

  function keyDown(e) {
    const k = e.key.toLowerCase();

    // Remap capture mode
    if (listeningFor) {
      e.preventDefault();
      if (k !== 'escape') {
        const conflict = Object.entries(keybinds).find(([id, v]) => v === k && id !== listeningFor);
        if (!conflict) { keybinds[listeningFor] = k; saveKeys(); }
      }
      listeningFor = null;
      renderControls();
      return;
    }

    keys.add(k);

    if (k === keybinds.restart) { resetAttempt(); return; }

    if (k === keybinds.jump) {
      e.preventDefault();
      if (state === 'ready' || state === 'result') { resetAttempt(); startRun(); return; }
      if (state === 'flight' && !titan.grounded && save.upgrades.doubleJump > 0) {
        const maxCharges = save.upgrades.doubleJump >= 5 ? 2 : 1;
        if (attempt.doubleJumpsUsed < maxCharges) { doDoubleJump(); return; }
      }
      tryJump();
      return;
    }

    if ((k === keybinds.runLeft || k === keybinds.runRight) && (state === 'ready' || state === 'runup')) {
      startRun();
      if (runInput.lastKey !== k) {
        const gain = 34 + save.upgrades.shoes * 5;
        titan.vx += gain;
        runInput.combo++;
        runInput.lastKey = k;
        runInput.spamHeat = Math.min(100, runInput.spamHeat + 9);
        footDust();
      } else {
        titan.vx += 3;
        runInput.spamHeat = Math.min(100, runInput.spamHeat + 18);
      }
    }
  }

  function keyUp(e) {
    keys.delete(e.key.toLowerCase());
  }

  function update(dt) {
    time += dt;

    if (state === "ready") {
      titan.anim = "idle";
      titan.vx *= 0.96;
    }

    if (state === "runup") {
      titan.anim = "run";
      const heatPenalty = runInput.spamHeat > 84 ? 110 : 0;
      titan.vx -= (110 + heatPenalty) * dt;
      titan.vx = clamp(titan.vx, 0, 760 + save.upgrades.shoes * 42 + save.upgrades.start * 25);
      runInput.spamHeat = Math.max(0, runInput.spamHeat - 34 * dt);

      // Auto-fail if too late after ramp
      if (titan.x > config.rampX + config.rampW + 220) {
        state = "flight";
        titan.grounded = false;
        titan.vy = -160;
        titan.vx *= .55;
        spawnFlightObjects();
        message("Trop tard !", "Titan a raté la rampe. R pour recommencer.");
      }
    }

    if (state === "flight") {
      titan.anim = keys.has(keybinds.rocket) && attempt.rocket > 0 ? "bark_energy_blast" : "jump";
      if (keys.has(keybinds.rocket)) doRocket(dt);
      const aero = 0.05 + save.upgrades.cape * 0.007;
      titan.vx *= (1 - aero * dt);
      titan.vy += 960 * dt;
      titan.rotation = clamp(titan.vy / 1200, -0.22, 0.45);

      if (titan.y >= config.groundY && titan.vy > 0) {
        titan.y = config.groundY;
        titan.rotation = 0;
        const bounceCoeff = 0.38 + save.upgrades.rubberBoots * 0.044;
        const nextVy      = titan.vy * bounceCoeff;
        const maxBounces  = 3 + save.upgrades.rubberBoots;
        if (nextVy > 62 && attempt.bounces < maxBounces) {
          attempt.bounces++;
          titan.vy = -nextVy;
          titan.vx *= 0.85;
          titan.grounded = false;
          titan.anim = "jump";
          titan.frame = 0;
          titan.y -= 3;
          burst(titan.x, titan.y, 6 + attempt.bounces * 4);
          floats.push({ x: titan.x, y: titan.y - 30, text: `×${attempt.bounces}`, life: 0.75, max: 0.75, vy: -65, color: "#f5e8c8" });
        } else {
          titan.grounded = true;
          titan.vx *= 0.55;
          burst(titan.x, titan.y - 20, 20);
          finishRun();
        }
      }
    }

    if (state === "result") {
      titan.vx *= Math.pow(0.2, dt);
    }

    titan.x += titan.vx * dt;
    titan.y += titan.vy * dt;
    attempt.maxSpeed = Math.max(attempt.maxSpeed, titan.vx);
    cameraX = Math.max(0, titan.x - 330);

    // Vertical camera: pan up when Titan flies high
    const vtarget = (state === 'flight' && !titan.grounded)
      ? Math.max(0, Math.min(185, 155 - titan.y))
      : 0;
    cameraY += (vtarget - cameraY) * Math.min(1, dt * 5);

    updateAnim(dt);
    updateParticles(dt);
    updateSprings(dt);
    if (state === 'flight' && !titan.grounded) {
      checkFlightObjects();
      checkSprings();
    }
    updateFloats(dt);
    updateMeters();
  }

  function updateMeters() {
    const maxV = 760 + save.upgrades.shoes * 42 + save.upgrades.start * 25;
    const spd = clamp(titan.vx / maxV * 100, 0, 100);
    el.speedMeter.value = spd;
    el.speedText.textContent = `${Math.round(spd)}%`;

    const rampCenter = config.rampX + config.rampW * 0.55;
    const dist = Math.abs(titan.x - rampCenter);
    const timing = state === "runup" ? clamp(100 - dist / 2.2, 0, 100) : attempt.jumpQuality * 100;
    el.timingMeter.value = timing;
    el.timingText.textContent = state === "runup" ? (timing > 70 ? "GO" : "—") : `${Math.round(timing)}%`;

    const rocketMax = 55 + save.upgrades.rocket * 16;
    const rocket = clamp(attempt.rocket / rocketMax * 100, 0, 100);
    el.rocketMeter.value = rocket;
    el.rocketText.textContent = `${Math.round(rocket)}%`;
  }

  function updateAnim(dt) {
    const a = anim[titan.anim] || anim.idle;
    if (!a || !a.frames.length) return;
    titan.frameT += dt;
    const dur = 1 / a.fps;
    while (titan.frameT > dur) {
      titan.frameT -= dur;
      titan.frame++;
      if (titan.frame >= a.frames.length) titan.frame = a.loop ? 0 : a.frames.length - 1;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    ctx.save();
    ctx.translate(0, Math.round(cameraY));
    drawTrack();
    drawPickups();
    drawSprings();
    drawParticles(true);
    drawTitan();
    drawParticles(false);
    drawFloats();
    ctx.restore();
    drawForegroundText();
  }

  function drawBackground() {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, config.groundY + 20);
    sky.addColorStop(0,    '#010b05');
    sky.addColorStop(0.42, '#061a0b');
    sky.addColorStop(0.80, '#0d2c15');
    sky.addColorStop(1,    '#132f18');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars — twinkle
    ctx.fillStyle = '#c8ffd8';
    for (const s of STARS) {
      ctx.globalAlpha = s.a * (0.5 + 0.5 * Math.sin(time * s.r * 1.9 + s.x * 0.014));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Mountain layers (back → front, darker → lighter dark)
    drawMtLayer(0.028, '#030e07', 118, config.groundY - 148, 0.00046);
    drawMtLayer(0.062, '#06100a', 85,  config.groundY -  96, 0.00080);
    drawMtLayer(0.115, '#091e0d', 60,  config.groundY -  54, 0.00128);

    // Tree line
    drawTreeLine(0.18, '#0d2413', 50, config.groundY - 5);

    // Horizon glow
    const haze = ctx.createLinearGradient(0, config.groundY - 72, 0, config.groundY);
    haze.addColorStop(0, 'rgba(40,200,70,0)');
    haze.addColorStop(1, 'rgba(50,220,80,.07)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, config.groundY - 72, W, 72);
  }

  function drawMtLayer(parallax, color, amp, baseY, freq) {
    const ox = cameraX * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const step = 14;
    for (let sx = -step; sx <= W + step * 2; sx += step) {
      const wx = sx + ox;
      const n  = Math.sin(wx * freq)         * 0.50
               + Math.sin(wx * freq * 1.79)  * 0.28
               + Math.sin(wx * freq * 3.13)  * 0.14
               + Math.sin(wx * freq * 6.91)  * 0.08;
      ctx.lineTo(sx, baseY - amp * (0.5 + n * 0.52));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawTreeLine(parallax, color, treeH, baseY) {
    const ox = cameraX * parallax;
    ctx.fillStyle = color;
    const sp = 34;
    const si = Math.floor(ox / sp) - 1;
    for (let i = si; i < si + Math.ceil(W / sp) + 4; i++) {
      const sx = i * sp - ox + ((i * 137 + 3) % 14) - 7;
      const h  = treeH + ((i * 31 + 5) % 18) - 9;
      ctx.beginPath();
      ctx.moveTo(sx - h * 0.34, baseY);
      ctx.lineTo(sx + h * 0.34, baseY);
      ctx.lineTo(sx,            baseY - h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTrack() {
    const ground = config.groundY + 20;
    ctx.save();
    ctx.translate(-cameraX, 0);

    // track
    ctx.fillStyle = "#152017";
    ctx.fillRect(cameraX - 60, ground, W + 140, H - ground);
    ctx.strokeStyle = "rgba(98,255,82,.45)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cameraX - 60, ground);
    ctx.lineTo(cameraX + W + 80, ground);
    ctx.stroke();

    // distance markers
    ctx.font = "700 18px system-ui";
    ctx.textAlign = "center";
    for (let m = 0; m < 2000; m += 10) {
      const x = config.startX + m / config.worldScale;
      if (x < cameraX - 100 || x > cameraX + W + 100) continue;
      ctx.strokeStyle = m % 50 === 0 ? "rgba(98,255,82,.55)" : "rgba(255,255,255,.18)";
      ctx.lineWidth = m % 50 === 0 ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(x, ground);
      ctx.lineTo(x, ground + (m % 50 === 0 ? 42 : 24));
      ctx.stroke();
      if (m % 50 === 0) {
        ctx.fillStyle = "rgba(236,255,240,.8)";
        ctx.fillText(`${m}m`, x, ground + 68);
      }
    }

    // start line
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillRect(config.startX - 8, ground - 78, 16, 78);
    ctx.fillStyle = "#62ff52";
    ctx.fillText("START", config.startX + 36, ground - 88);

    // ramp
    const rx = config.rampX;
    const rw = config.rampW + save.upgrades.ramp * 8;
    const rh = config.rampH + save.upgrades.ramp * 2;
    ctx.fillStyle = "#1a271c";
    ctx.beginPath();
    ctx.moveTo(rx, ground);
    ctx.lineTo(rx + rw, ground);
    ctx.lineTo(rx + rw, ground - rh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#62ff52";
    ctx.lineWidth = 4;
    ctx.stroke();

    const zoneW = 82 + save.upgrades.ramp * 8;
    ctx.fillStyle = "rgba(98,255,82,.22)";
    ctx.fillRect(rx + rw * .55 - zoneW / 2, ground - rh - 10, zoneW, 10);
    ctx.fillStyle = "#62ff52";
    ctx.font = "800 18px system-ui";
    ctx.fillText("JUMP", rx + rw * .55, ground - rh - 20);

    ctx.restore();
  }

  function drawTitan() {
    const a = anim[titan.anim] || anim.idle;
    const img = a.frames[titan.frame % a.frames.length];
    if (!img) return;

    const targetH = 185;
    const scale = targetH / img.height;
    const w = img.width * scale;
    const h = img.height * scale;
    const sx = titan.x - cameraX;
    const sy = titan.y - h + 22;

    ctx.save();
    ctx.translate(sx, sy + h);
    ctx.rotate(titan.rotation);
    ctx.drawImage(img, -w * .5, -h, w, h);
    ctx.restore();
  }

  function drawForegroundText() {
    const dist = Math.max(0, (titan.x - config.startX) * config.worldScale);
    ctx.save();
    ctx.fillStyle = "rgba(4,14,8,.72)";
    roundRect(ctx, W - 230, 92, 190, 70, 14);
    ctx.fill();
    ctx.fillStyle = "#ecfff0";
    ctx.font = "900 30px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(`${dist.toFixed(1)} m`, W - 58, 138);
    ctx.font = "600 13px system-ui";
    ctx.fillStyle = "rgba(236,255,240,.65)";
    ctx.fillText("distance tentative", W - 58, 158);
    ctx.restore();
  }

  function footDust() {
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: titan.x - 40 + Math.random() * 40,
        y: config.groundY - 6,
        vx: -80 - Math.random() * 150,
        vy: -30 - Math.random() * 60,
        life: .28,
        max: .28,
        r: 3 + Math.random() * 6,
        color: "rgba(190,190,180,"
      });
    }
  }

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 360;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: .45 + Math.random() * .35,
        max: .8,
        r: 4 + Math.random() * 10,
        color: "rgba(98,255,82,"
      });
    }
  }

  // ── Flight objects ───────────────────────────────────────────────────────────
  function spawnFlightObjects() {
    const rx = config.rampX + config.rampW;
    // Os sur 3 niveaux de hauteur (valeur croissante)
    const tiers = [
      { yBase: config.groundY - 95,  value: 3,  count: 4 },
      { yBase: config.groundY - 230, value: 7,  count: 4 },
      { yBase: config.groundY - 390, value: 15, count: 3 },
    ];
    let xCursor = rx + 180;
    tiers.forEach(tier => {
      for (let i = 0; i < tier.count; i++) {
        pickups.push({
          x: xCursor + Math.random() * 60,
          y: tier.yBase + (Math.random() - .5) * 70,
          type: 'bone', value: tier.value, r: 22,
          collected: false, pulse: Math.random() * Math.PI * 2,
        });
        xCursor += 220 + Math.random() * 80;
      }
      xCursor += 100;
    });

    // 2 canisters de carburant
    [rx + 550, rx + 1450].forEach(bx => {
      pickups.push({
        x: bx + Math.random() * 120,
        y: config.groundY - 180 - Math.random() * 100,
        type: 'fuel', value: 20, r: 20,
        collected: false, pulse: Math.random() * Math.PI * 2,
      });
    });

    // 3 rochers (obstacles)
    [rx + 650, rx + 1250, rx + 2000].forEach(bx => {
      obstacles.push({
        x: bx + Math.random() * 100,
        y: config.groundY - 130 - Math.random() * 140,
        w: 68, h: 50, hit: false,
      });
    });

    // 2 tremplins de rebond (timing ring)
    [rx + 1050, rx + 1850].forEach(bx => {
      springs.push({
        x: bx + Math.random() * 180,
        y: config.groundY - 140 - Math.random() * 200,
        r: 24, phase: Math.random(), period: 1.7, hit: false,
      });
    });
  }

  function checkFlightObjects() {
    const tx = titan.x;
    const ty = titan.y - 88; // centre approximatif de Titan

    for (const p of pickups) {
      if (p.collected) continue;
      const dx = tx - p.x, dy = ty - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < p.r + 26) {
        p.collected = true;
        if (p.type === 'bone') {
          attempt.bonusCoins += p.value;
          floats.push({ x: p.x, y: p.y - 10, text: `+${p.value} os`, life: 1.1, max: 1.1, vy: -55, color: '#f5e8c8' });
          burst(p.x, p.y, 7);
        } else {
          const fuelMax = 55 + save.upgrades.rocket * 16;
          attempt.rocket = Math.min(attempt.rocket + p.value, fuelMax);
          floats.push({ x: p.x, y: p.y - 10, text: '+fuel', life: 1.1, max: 1.1, vy: -55, color: '#62ff52' });
          burst(p.x, p.y, 10);
        }
      }
    }

    for (const o of obstacles) {
      if (o.hit) continue;
      if (tx > o.x - o.w / 2 - 20 && tx < o.x + o.w / 2 + 20 &&
          ty > o.y - o.h / 2 - 20 && ty < o.y + o.h / 2 + 20) {
        o.hit = true;
        titan.vx *= 0.62;
        burst(titan.x, titan.y - 80, 16);
        floats.push({ x: o.x, y: o.y - 30, text: 'IMPACT !', life: 1.2, max: 1.2, vy: -45, color: '#ff4b4b' });
      }
    }
  }

  function updateFloats(dt) {
    floats.forEach(f => { f.y += f.vy * dt; f.life -= dt; });
    floats = floats.filter(f => f.life > 0);
  }

  // ── Springs (timing rebond) ───────────────────────────────────────────────────
  function updateSprings(dt) {
    for (const s of springs) {
      if (!s.hit) s.phase = (s.phase + dt / s.period) % 1;
    }
  }

  function checkSprings() {
    const tx = titan.x;
    const ty = titan.y - 88;
    for (const s of springs) {
      if (s.hit) continue;
      const dx = tx - s.x, dy = ty - s.y;
      if (Math.sqrt(dx * dx + dy * dy) > s.r + 32) continue;
      s.hit = true;
      // quality 0..1 : peak quand phase ≈ 0.5 (anneau le plus petit)
      const quality = Math.sin(s.phase * Math.PI);
      const power   = 240 + quality * 440;
      titan.vy = -power;
      titan.vx *= 1.0 + quality * 0.10;
      titan.anim = 'jump';
      titan.frame = 0;
      burst(s.x, s.y, 8 + Math.floor(quality * 22));
      if (quality > 0.72) {
        floats.push({ x: s.x, y: s.y - 20, text: 'PARFAIT !', life: 1.2, max: 1.2, vy: -65, color: '#62ff52' });
      } else if (quality > 0.35) {
        floats.push({ x: s.x, y: s.y - 20, text: 'BON !',     life: 1.0, max: 1.0, vy: -55, color: '#aaff77' });
      } else {
        floats.push({ x: s.x, y: s.y - 20, text: 'RATÉ…',     life: 0.9, max: 0.9, vy: -40, color: '#ff8844' });
      }
    }
  }

  function drawSprings() {
    ctx.save();
    ctx.translate(-cameraX, 0);
    for (const s of springs) {
      if (s.hit) {
        // pad grisé après utilisation
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#888';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      // quality signal
      const q   = Math.sin(s.phase * Math.PI); // 0→1, pic à phase=0.5
      const ringR = s.r + (1 - q) * 58;
      // couleur : rouge quand anneau large, vert quand anneau serré
      const rv  = Math.round(255 * (1 - q));
      const gv  = Math.round(180 * q + 75);
      const col = `rgb(${rv},${gv},60)`;

      // anneau de timing
      ctx.globalAlpha = 0.35 + q * 0.45;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3 + q * 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2); ctx.stroke();

      // deuxième anneau plus fin
      ctx.globalAlpha = 0.15 + q * 0.2;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, ringR * 1.35, 0, Math.PI * 2); ctx.stroke();

      // pad central
      ctx.globalAlpha = 1;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      grad.addColorStop(0, `rgb(${rv},${gv},80)`);
      grad.addColorStop(1, `rgba(${rv},${gv},40,.6)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#07150d';
      ctx.font = `800 ${s.r}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↑', s.x, s.y);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ── Draw flight objects ───────────────────────────────────────────────────────
  function drawPickups() {
    ctx.save();
    ctx.translate(-cameraX, 0);
    const t = time * 3;

    for (const p of pickups) {
      if (p.collected) continue;
      const pulse = 0.88 + Math.sin(t + p.pulse) * 0.12;
      const r = p.r * pulse;

      if (p.type === 'bone') {
        // halo
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#f5e8c8';
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.8, 0, Math.PI * 2); ctx.fill();
        // circle
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f0dea0';
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        // value
        ctx.fillStyle = '#152017';
        ctx.font = `800 ${Math.round(r * .85)}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.value, p.x, p.y);
        // label
        ctx.globalAlpha = 0.65; ctx.fillStyle = '#f5e8c8';
        ctx.font = '700 10px system-ui';
        ctx.fillText('OS', p.x, p.y + r + 11);
      } else {
        // fuel canister
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#62ff52';
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#1fb83a';
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ecfff0';
        ctx.font = `800 ${Math.round(r * .9)}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚡', p.x, p.y);
        ctx.globalAlpha = 0.65; ctx.fillStyle = '#62ff52';
        ctx.font = '700 10px system-ui';
        ctx.fillText('FUEL', p.x, p.y + r + 11);
      }
      ctx.globalAlpha = 1;
    }

    for (const o of obstacles) {
      ctx.globalAlpha = o.hit ? 0.28 : 1;
      ctx.fillStyle = '#200a0a';
      ctx.strokeStyle = o.hit ? 'rgba(255,75,75,.3)' : 'rgba(255,75,75,.8)';
      ctx.lineWidth = 3;
      roundRect(ctx, o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 10);
      ctx.fill(); ctx.stroke();
      if (!o.hit) {
        ctx.fillStyle = 'rgba(255,75,75,.9)';
        ctx.font = '700 22px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✕', o.x, o.y);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawFloats() {
    ctx.save();
    ctx.translate(-cameraX, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of floats) {
      const alpha = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = '800 18px system-ui';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function updateParticles(dt) {
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);
  }

  function drawParticles(behind) {
    ctx.save();
    ctx.translate(-cameraX, 0);
    for (const p of particles) {
      if (((p.z ?? 0) === 0) !== behind) continue;
      const alpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = `${p.color}${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  el.resetSave.onclick = () => {
    if (!confirm("Supprimer la sauvegarde Titan Rocket Run ?")) return;
    localStorage.removeItem("titanRocketRunSave");
    save = loadSave();
    resetAttempt();
    updateUI();
  };

  loadAssets().then(() => {
    updateUI();
    resetAttempt();
    requestAnimationFrame(loop);
  });
})();
