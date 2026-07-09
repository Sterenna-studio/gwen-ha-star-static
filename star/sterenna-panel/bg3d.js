/*
  Sterenna BG3D
  - Fond WebGL (three.js) : étoiles + grille + vaisseaux qui passent de temps à autre
  - API globale : window.SterennaBG3D.{setTheme,setConfig}
*/

(function () {
  const canvas = document.getElementById("bg3d");
  if (!canvas) return;

  if (!window.THREE) {
    console.warn("[BG3D] three.js non chargé (réseau ?)");
    canvas.style.display = "none";
    return;
  }

  const THREE = window.THREE;

  // --- Config & state
  let cfg = { enabled: true, shipRate: 1.0 };
  let theme = { alert: false, night: false, bzh: true, monitorStyle: "default" };

  // --- Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance"
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  // --- Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02040b, 0.012);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
  camera.position.set(0, 10, 36);
  camera.lookAt(0, 6, -20);

  const ambient = new THREE.AmbientLight(0x66ccff, 0.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.65);
  key.position.set(18, 26, 12);
  scene.add(key);

  // --- Grid floor
  const grid = new THREE.GridHelper(260, 52, 0x00f6ff, 0x12324a);
  grid.position.y = 0;
  grid.material.transparent = true;
  grid.material.opacity = 0.10;
  scene.add(grid);

  // --- Stars
  const starCount = 1400;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const idx = i * 3;
    starPos[idx + 0] = (Math.random() - 0.5) * 260;
    starPos[idx + 1] = Math.random() * 140;
    starPos[idx + 2] = -260 + Math.random() * 320;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0x66ccff,
    size: 0.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- Ships
  const ships = [];

  function pickColors() {
    // Palette simple : bzh (cyan/ambre), alert (rouge), night (plus sombre)
    const base = theme.alert ? 0xff3b6a : 0x00f6ff;
    const accent = theme.alert ? 0xff3b6a : (theme.bzh ? 0xffdd55 : 0x66ccff);
    const dim = theme.night ? 0.55 : 1.0;
    return {
      base,
      accent,
      dim
    };
  }

  function makeShip() {
    const colors = pickColors();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x0d1220,
      emissive: colors.base,
      emissiveIntensity: 0.85 * colors.dim,
      metalness: 0.25,
      roughness: 0.35
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f18,
      emissive: colors.base,
      emissiveIntensity: 1.1 * colors.dim,
      metalness: 0.0,
      roughness: 0.2
    });

    const thrMat = new THREE.MeshBasicMaterial({
      color: colors.accent,
      transparent: true,
      opacity: 0.9
    });

    const g = new THREE.Group();

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.1, 6.2, 8, 1), hullMat);
    body.rotation.z = Math.PI / 2;
    g.add(body);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), glassMat);
    cockpit.position.x = 2.7;
    g.add(cockpit);

    const wingGeom = new THREE.BoxGeometry(0.22, 2.4, 1.7);
    const wingA = new THREE.Mesh(wingGeom, hullMat);
    wingA.position.set(0.0, 0.0, 1.2);
    g.add(wingA);
    const wingB = wingA.clone();
    wingB.position.z = -1.2;
    g.add(wingB);

    const thr = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.9, 10), thrMat);
    thr.rotation.z = -Math.PI / 2;
    thr.position.x = -3.25;
    g.add(thr);

    // petite "antenne"
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), hullMat);
    fin.position.set(-0.2, 0.9, 0);
    g.add(fin);

    return g;
  }

  function spawnShip() {
    if (!cfg.enabled) return;
    const s = makeShip();

    const y = 2.5 + Math.random() * 22;
    const z = -90 - Math.random() * 240;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const startX = dir > 0 ? -150 : 150;
    s.position.set(startX, y, z);
    s.rotation.y = dir > 0 ? 0 : Math.PI;
    s.rotation.z = (Math.random() - 0.5) * 0.35;

    const speed = (14 + Math.random() * 18) * Math.max(0.15, cfg.shipRate);

    scene.add(s);
    ships.push({ obj: s, dir, speed });
  }

  let nextSpawnAt = performance.now() + 6000;
  function scheduleNext(now) {
    // base 15-45s, modulée par shipRate (plus shipRate est grand, plus ça spawn)
    const rate = Math.max(0.15, cfg.shipRate);
    const factor = 1 / rate;
    const min = 15000 * factor;
    const max = 45000 * factor;
    nextSpawnAt = now + (min + Math.random() * (max - min));
  }

  // --- Resize
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // --- Theme apply
  function applyTheme() {
    const c = pickColors();
    starMat.color.setHex(theme.alert ? 0xff3b6a : 0x66ccff);
    starMat.opacity = theme.night ? 0.65 : 0.9;
    grid.material.opacity = theme.night ? 0.07 : 0.10;
    scene.fog.color.setHex(theme.alert ? 0x120207 : 0x02040b);
    ambient.intensity = 0.35 * c.dim;
    key.intensity = 0.65 * c.dim;
  }
  applyTheme();

  // --- Animation
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Hide/disable
    canvas.style.display = cfg.enabled ? "block" : "none";

    if (cfg.enabled) {
      // subtle camera drift
      camera.position.x = Math.sin(now / 5000) * 1.2;
      camera.position.y = 10 + Math.sin(now / 7000) * 0.6;
      camera.lookAt(0, 6, -20);

      // move grid forward (illusion de déplacement)
      grid.position.z += dt * 6.0;
      if (grid.position.z > 14) grid.position.z = 0;

      // stars "warp"
      const pos = starGeo.getAttribute("position");
      for (let i = 0; i < starCount; i++) {
        const idx = i * 3 + 2;
        pos.array[idx] += dt * 40;
        if (pos.array[idx] > 80) {
          pos.array[idx] = -260;
        }
      }
      pos.needsUpdate = true;

      // spawn ships
      if (now >= nextSpawnAt) {
        const burst = Math.random() < 0.22 ? 2 : 1;
        for (let i = 0; i < burst; i++) spawnShip();
        scheduleNext(now);
      }

      // update ships
      for (let i = ships.length - 1; i >= 0; i--) {
        const s = ships[i];
        s.obj.position.x += s.dir * s.speed * dt;
        s.obj.position.y += Math.sin((now / 900) + i) * dt * 0.6;

        if (Math.abs(s.obj.position.x) > 170) {
          scene.remove(s.obj);
          ships.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // --- Public API
  window.SterennaBG3D = {
    setTheme(next) {
      theme = { ...theme, ...(next || {}) };
      applyTheme();
    },
    setConfig(next) {
      if (!next) return;
      if (typeof next.enabled === "boolean") cfg.enabled = next.enabled;
      if (typeof next.shipRate === "number" && Number.isFinite(next.shipRate)) {
        cfg.shipRate = Math.max(0.1, Math.min(5, next.shipRate));
      }
      // reset scheduling when changing rate
      scheduleNext(performance.now());
    }
  };
})();
