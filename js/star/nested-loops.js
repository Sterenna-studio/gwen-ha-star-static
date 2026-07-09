const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: true });
const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const ui = document.getElementById('ui');
const togglePanel = document.getElementById('togglePanel');
const collapseBtn = document.getElementById('collapseBtn');
const modeChips = [...document.querySelectorAll('[data-mode]')];
const paperChips = [...document.querySelectorAll('[data-paper]')];
const layerChips = [...document.querySelectorAll('[data-layer]')];
const paperSection = document.getElementById('paperSection');
const stepLabel = document.getElementById('stepLabel');
const phaseLabel = document.getElementById('phaseLabel');

const ids = ['speed', 'spread', 'twist', 'tilt', 'depth', 'trail', 'points', 'rings', 'phase', 'buildStep'];
const sliders = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const vals = Object.fromEntries(['speed', 'spread', 'twist', 'tilt', 'depth', 'trail', 'points', 'rings'].map(id => [id, document.getElementById(id + 'Val')]));

const state = {
  paused: false,
  mode: 'sculpture',
  paperPreset: 'cube',
  stepMode: true,
  layers: { combined: true, axes: true, loops: true, platforms: true, connectors: true },
  guides: true,
  nodes: true,
  ghost: true,
  t: 0,
  zoom: 1,
  yaw: 0.18,
  pitch: 0.55,
  dragging: false,
  lx: 0,
  ly: 0
};

const palette = ['#6de8ff', '#b58cff', '#ff74b8', '#ffd479', '#7dffbf', '#97a8ff', '#ff9f7d', '#d0ff88', '#ff7de2', '#9effff'];
const stageLabels = ['0 · axes seulement', '1 · boucles de base', '2 · boucles complètes', '3 · plateformes / liaisons', '4 · assemblage complet'];

function n(id) {
  return Number(sliders[id]?.value ?? 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function deg(angle) {
  return angle * Math.PI / 180;
}

function resize() {
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  clearAll();
}

function updateVals() {
  vals.speed.textContent = n('speed').toFixed(2) + '×';
  vals.spread.textContent = n('spread').toFixed(2);
  vals.twist.textContent = n('twist').toFixed(2);
  vals.tilt.textContent = Math.round(n('tilt') * 100) + '%';
  vals.depth.textContent = Math.round(n('depth') * 100) + '%';
  vals.trail.textContent = Math.round(n('trail') * 100) + '%';
  vals.points.textContent = n('points');
  vals.rings.textContent = n('rings');
  phaseLabel.textContent = 'Ouverture : ' + Math.round(n('phase') * 100) + '%';
  stepLabel.textContent = 'Étape active : ' + stageLabels[n('buildStep')];
}

function clearAll() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function fade() {
  const trail = n('trail');
  if (trail <= 0.02) {
    clearAll();
    return;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(5, 7, 14, ${1 - trail})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function viewCenter() {
  if (ui.classList.contains('hidden')) return { x: innerWidth / 2, y: innerHeight / 2 };
  const rect = ui.getBoundingClientRect();
  const leftEdge = rect.right + 18;
  const x = leftEdge < innerWidth ? leftEdge + (innerWidth - leftEdge) / 2 : innerWidth / 2;
  return { x, y: innerHeight / 2 };
}

function rotate3([x, y, z]) {
  const cy = Math.cos(state.yaw);
  const sy = Math.sin(state.yaw);
  const cp = Math.cos(state.pitch);
  const sp = Math.sin(state.pitch);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y1 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  return [x1, y1, z2];
}

function project([x, y, z]) {
  const center = viewCenter();
  const base = Math.min(innerWidth, innerHeight) * 0.37 * state.zoom;
  const persp = 1 / (1 + z * 0.0016 * n('depth'));
  return { x: center.x + x * base * persp, y: center.y + y * base * persp, z, s: persp };
}

function p3(vector) {
  const pr = project(rotate3(vector));
  pr.base = vector;
  return pr;
}

function scale(vector, amount) {
  return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function normalize(vector) {
  const magnitude = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function rotX(vector, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [vector[0], vector[1] * c - vector[2] * s, vector[1] * s + vector[2] * c];
}

function rotY(vector, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [vector[0] * c + vector[2] * s, vector[1], -vector[0] * s + vector[2] * c];
}

function sph(azDeg, elDeg) {
  const az = deg(azDeg);
  const el = deg(elDeg);
  return normalize([Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]);
}

function hexAlpha(hex, alpha) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function line(a, b, color, alpha, width) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = hexAlpha(color, alpha);
  ctx.lineWidth = width * Math.min(a.s || 1, b.s || 1);
  ctx.lineCap = 'round';
  ctx.stroke();
}

function polyline(points, color, alpha, width, close = false) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  if (close) ctx.closePath();
  ctx.strokeStyle = hexAlpha(color, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function fillPoly(points, color, alpha) {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = hexAlpha(color, alpha);
  ctx.fill();
}

function drawGlowPoint(point, color, radius) {
  const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 4);
  gradient.addColorStop(0, hexAlpha(color, 0.85));
  gradient.addColorStop(0.28, hexAlpha(color, 0.22));
  gradient.addColorStop(1, hexAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexAlpha('#ffffff', 0.92);
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function computePoints(t) {
  const rings = n('rings');
  const pts = n('points');
  const spread = n('spread');
  const twist = n('twist');
  const tilt = n('tilt');
  const depth = n('depth');
  const all = [];
  const minR = 0.20;
  const maxR = 0.90 * spread;

  for (let r = 0; r < rings; r += 1) {
    const q = rings === 1 ? 0 : r / (rings - 1);
    const radius = minR + (maxR - minR) * q;
    const ring = [];

    for (let p = 0; p < pts; p += 1) {
      const a = t + p * Math.PI * 2 / pts + r * twist;
      const breathe = 1 + 0.11 * Math.sin(t * 2 + p * 0.73 + r * 1.4);
      const x = radius * breathe * Math.cos(a);
      const y = radius * breathe * Math.sin(a) * (1 - tilt * 0.22);
      const z = (Math.sin(a + r * 0.7) * 0.34 + Math.sin(t * 0.75 + r * 1.1 + p * 0.45) * 0.16) * depth * 380;
      const pr = project(rotate3([x, y, z]));
      pr.r = r;
      pr.p = p;
      pr.base = [x, y, z];
      ring.push(pr);
    }

    all.push(ring);
  }

  return all;
}

function drawGuides(points) {
  if (!state.guides) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pts = n('points');
  for (let r = 0; r < points.length; r += 1) {
    const color = palette[r % palette.length];
    ctx.beginPath();
    for (let i = 0; i <= pts; i += 1) {
      const point = points[r][i % pts];
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.strokeStyle = hexAlpha(color, 0.17);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawGhosts(t) {
  if (!state.ghost) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const offset of [-1.15, -0.58, 0.58, 1.15]) {
    const ghosts = computePoints(t + offset);
    for (let r = 0; r < ghosts.length - 1; r += 1) {
      const color = palette[(r + 2) % palette.length];
      for (let p = 0; p < ghosts[r].length; p += 1) {
        line(ghosts[r][p], ghosts[r + 1][(p + 1) % ghosts[r].length], color, 0.035, 1.2);
      }
    }
  }
  ctx.restore();
}

function drawRingOutlines(points) {
  for (let r = 0; r < points.length; r += 1) {
    const color = palette[r % palette.length];
    for (let p = 0; p < points[r].length; p += 1) {
      line(points[r][p], points[r][(p + 1) % points[r].length], color, 0.28, 1.9);
    }
  }
}

function drawSculpture(points) {
  const pts = n('points');
  for (let r = 0; r < points.length - 1; r += 1) {
    const c1 = palette[r % palette.length];
    const c2 = palette[(r + 1) % palette.length];
    for (let p = 0; p < pts; p += 1) {
      const a = points[r][p];
      const b = points[r + 1][p];
      const c = points[r + 1][(p + 1) % pts];
      const d = points[r][(p + 1) % pts];
      line(a, b, c1, 0.62, 3.2);
      line(a, c, c2, 0.42, 2.2);
      line(d, b, '#ffffff', 0.18, 1.2);
    }
  }
  drawRingOutlines(points);
}

function drawCourbes(points) {
  const pts = n('points');
  for (let p = 0; p < pts; p += 1) {
    const color = palette[p % palette.length];
    ctx.beginPath();
    for (let r = 0; r < points.length; r += 1) {
      const q = points[r][p];
      if (r === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = hexAlpha(color, 0.72);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  for (let r = 0; r < points.length - 1; r += 1) {
    for (let p = 0; p < pts; p += 1) line(points[r][p], points[r + 1][(p + 1) % pts], '#ffffff', 0.11, 1.2);
  }
}

function drawMirror(points) {
  const pts = n('points');
  for (let r = 0; r < points.length - 1; r += 1) {
    const color = palette[(r + 1) % palette.length];
    for (let p = 0; p < pts; p += 1) {
      const a = points[r][p];
      const b = points[r + 1][(pts - p) % pts];
      const c = points[r + 1][(pts - 1 - p + pts) % pts];
      line(a, b, color, 0.62, 2.8);
      line(a, c, '#ffffff', 0.14, 1.3);
    }
  }
  drawRingOutlines(points);
}

function drawMulti(points) {
  const pts = n('points');
  for (let r = 0; r < points.length - 1; r += 1) {
    const color = palette[r % palette.length];
    for (let p = 0; p < pts; p += 1) {
      const a = points[r][p];
      line(a, points[r + 1][p], color, 0.52, 2.3);
      line(a, points[r + 1][(p + 1) % pts], '#ffffff', 0.18, 1.4);
      line(a, points[r + 1][(p - 1 + pts) % pts], palette[(r + 2) % palette.length], 0.26, 1.6);
    }
  }
  drawRingOutlines(points);
}

function drawContinu(points) {
  const pts = n('points');
  const chain = [];
  for (let p = 0; p < pts; p += 1) {
    if (p % 2 === 0) {
      for (let r = 0; r < points.length; r += 1) chain.push(points[r][p]);
    } else {
      for (let r = points.length - 1; r >= 0; r -= 1) chain.push(points[r][p]);
    }
  }
  polyline(chain, '#6de8ff', 0.78, 3.2, false);
  for (let i = 0; i < chain.length - 1; i += 1) line(chain[i], chain[i + 1], palette[i % palette.length], 0.34, 1.8);
  drawRingOutlines(points);
}

function drawNodes(points) {
  if (!state.nodes) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let r = 0; r < points.length; r += 1) {
    const color = palette[r % palette.length];
    for (const point of points[r]) drawGlowPoint(point, color, 3.2 + r * 0.35);
  }
  ctx.restore();
}

function basePaperModel() {
  const twistOffset = state.t * 8 + n('twist') * 18;
  if (state.paperPreset === 'cube') {
    const dirs = [
      [1, 1, 1], [1, -1, 1], [-1, -1, 1], [-1, 1, 1],
      [1, 1, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1]
    ].map(normalize).map(v => rotY(v, deg(twistOffset)));
    const loops = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 4, 7, 3], [1, 5, 6, 2]];
    const connectors = [[0, 4], [1, 5], [2, 6], [3, 7]];
    const platforms = loops.map(loop => ({ loop }));
    return { dirs, loops, platforms, connectors };
  }

  if (state.paperPreset === 'arith') {
    const elevations = [15.5, 17.5, 19.5, 21.5, 23.5, 25.5, 27.5, 29.5];
    const dirs = elevations.map((el, i) => sph(i * 45 + twistOffset, el));
    const loop = Array.from({ length: 8 }, (_, i) => i);
    const platforms = loop.map((idx, i) => ({ edge: [idx, loop[(i + 1) % loop.length]] }));
    return { dirs, loops: [loop], platforms, connectors: loop.map(i => [i, i]) };
  }

  if (state.paperPreset === 'ortho') {
    const elevations = [15.5, 17.5, 19.5, 21.5, 23.5, 25.5, 27.5, 29.5];
    const loopA = elevations.map((el, i) => sph(i * 45 + twistOffset, el));
    const loopB = loopA.map(v => rotY(rotX(v, Math.PI / 2), Math.PI / 2));
    const dirs = [...loopA, ...loopB].map(normalize);
    const loops = [Array.from({ length: 8 }, (_, i) => i), Array.from({ length: 8 }, (_, i) => i + 8)];
    const connectors = Array.from({ length: 8 }, (_, i) => [i, i + 8]);
    const platforms = [];
    loops.forEach(loop => {
      for (let i = 0; i < loop.length; i += 1) platforms.push({ edge: [loop[i], loop[(i + 1) % loop.length]] });
    });
    connectors.forEach(pair => platforms.push({ bridge: pair }));
    return { dirs, loops, platforms, connectors };
  }

  const dirs = [];
  const levels = 7;
  const perLevel = 3;
  for (let level = 0; level < levels; level += 1) {
    const z = 0.95 - (1.9 * level / (levels - 1));
    const rot = level * 60 + twistOffset;
    for (let j = 0; j < perLevel; j += 1) dirs.push(normalize([Math.cos(deg(j * 120 + rot)), Math.sin(deg(j * 120 + rot)), z]));
  }
  dirs.push([0, 0, 1]);
  dirs.push([0, 0, -1]);
  const loops = [];
  for (let level = 0; level < levels; level += 1) loops.push([level * 3, level * 3 + 1, level * 3 + 2]);
  for (let helix = 0; helix < 3; helix += 1) loops.push(Array.from({ length: 7 }, (_, level) => level * 3 + helix));
  const platforms = [];
  for (let level = 0; level < levels - 1; level += 1) {
    for (let j = 0; j < perLevel; j += 1) platforms.push({ quad: [level * 3 + j, level * 3 + (j + 1) % 3, (level + 1) * 3 + (j + 1) % 3, (level + 1) * 3 + j] });
  }
  [0, 1, 2].forEach(i => platforms.push({ tri: [21, i, (i + 1) % 3] }));
  [18, 19, 20].forEach((i, k) => platforms.push({ tri: [22, i, 18 + ((k + 1) % 3)] }));
  return { dirs: dirs.map(normalize), loops, platforms, connectors: dirs.map((_, i) => [i, i]) };
}

function materializePaperModel(phase) {
  const base = basePaperModel();
  const spread = n('spread');
  const radius = lerp(0.14, 0.62, phase) * spread;
  const innerRadius = radius * 0.58;
  const center = p3([0, 0, 0]);
  const outer = base.dirs.map(direction => p3(scale(direction, radius)));
  const mirrored = base.dirs.map(direction => p3(scale(direction, -innerRadius)));
  return { ...base, center, outer, mirrored, phase };
}

function layerOn(name) {
  return state.layers.combined || state.layers[name];
}

function currentBuildStep() {
  return state.stepMode ? n('buildStep') : 4;
}

function currentPhase() {
  return state.stepMode ? n('phase') : (0.5 + 0.5 * Math.sin(state.t * 0.9));
}

function drawPaperMode() {
  const model = materializePaperModel(currentPhase());
  const step = currentBuildStep();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (layerOn('axes') && step >= 0) {
    model.dirs.forEach((direction, i) => {
      const a = p3(scale(direction, 0.82 * n('spread')));
      const b = p3(scale(direction, -0.82 * n('spread')));
      line(a, b, palette[i % palette.length], 0.12, 1.2);
      line(model.center, model.outer[i], '#ffffff', 0.07, 1.0);
    });
  }

  if (layerOn('loops') && step >= 1) {
    model.loops.forEach((loop, index) => {
      const partial = step === 1 ? loop.slice(0, Math.max(2, Math.ceil(loop.length / 2))) : loop;
      polyline(partial.map(i => model.outer[i]), palette[index % palette.length], 0.7, 2.6, partial.length === loop.length);
      if (step >= 2 && partial.length === loop.length) polyline(loop.map(i => model.mirrored[i]), palette[(index + 2) % palette.length], 0.22, 1.5, true);
    });
  }

  if (layerOn('platforms') && step >= 3) {
    model.platforms.forEach((platform, index) => {
      const color = palette[(index + 3) % palette.length];
      if (platform.loop) {
        const poly = platform.loop.map(i => model.outer[i]);
        fillPoly(poly, color, 0.06);
        polyline(poly, color, 0.18, 1.0, true);
      }
      if (platform.edge) {
        const [a, b] = platform.edge;
        const poly = [model.outer[a], model.outer[b], model.mirrored[b], model.mirrored[a]];
        fillPoly(poly, color, 0.08);
        polyline(poly, color, 0.2, 1.2, true);
      }
      if (platform.bridge) {
        const [a, b] = platform.bridge;
        const mid = p3(scale(normalize(add(model.outer[a].base, model.outer[b].base)), 0.22));
        const poly = [model.outer[a], model.outer[b], mid];
        fillPoly(poly, color, 0.1);
        polyline(poly, '#ffffff', 0.18, 1.0, true);
      }
      if (platform.quad) {
        const poly = platform.quad.map(i => model.outer[i]);
        fillPoly(poly, color, 0.08);
        polyline(poly, color, 0.18, 1.0, true);
      }
      if (platform.tri) {
        const poly = platform.tri.map(i => model.outer[i]);
        fillPoly(poly, color, 0.09);
        polyline(poly, '#ffffff', 0.18, 1.0, true);
      }
    });
  }

  if (layerOn('connectors') && step >= 2) {
    model.connectors.forEach((pair, index) => {
      const color = palette[(index + 5) % palette.length];
      if (pair[0] === pair[1]) line(model.outer[pair[0]], model.mirrored[pair[1]], color, 0.22, 1.15);
      else {
        line(model.outer[pair[0]], model.outer[pair[1]], color, 0.28, 1.6);
        line(model.mirrored[pair[0]], model.mirrored[pair[1]], '#ffffff', 0.1, 1.0);
      }
    });
  }

  if (state.nodes) {
    model.outer.forEach((point, i) => drawGlowPoint(point, palette[i % palette.length], model.dirs.length > 20 ? 2.1 : 2.8));
    if (step >= 2) model.mirrored.forEach((point, i) => drawGlowPoint(point, palette[(i + 2) % palette.length], model.dirs.length > 20 ? 1.6 : 2.0));
    drawGlowPoint(model.center, '#ffffff', 2.4);
  }

  ctx.restore();
}

function drawCenterHalo() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const center = viewCenter();
  const radius = Math.min(innerWidth, innerHeight) * 0.26 * state.zoom;
  const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 1.4);
  gradient.addColorStop(0, 'rgba(109, 232, 255, .08)');
  gradient.addColorStop(0.42, 'rgba(181, 140, 255, .035)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function setMode(mode) {
  state.mode = mode;
  modeChips.forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  paperSection.classList.toggle('hidden', mode !== 'paper');
  clearAll();
}

function setPaperPreset(name) {
  state.paperPreset = name;
  paperChips.forEach(button => button.classList.toggle('active', button.dataset.paper === name));
  clearAll();
}

function toggleLayer(name) {
  if (name === 'combined') {
    const next = !state.layers.combined;
    Object.keys(state.layers).forEach(layerName => { state.layers[layerName] = next; });
  } else {
    state.layers[name] = !state.layers[name];
    state.layers.combined = false;
  }
  layerChips.forEach(button => button.classList.toggle('active', state.layers[button.dataset.layer]));
  clearAll();
}

function frame(now) {
  const dt = Math.min(0.05, (now - frame.last) / 1000);
  frame.last = now;
  if (!state.paused) state.t += dt * n('speed');
  fade();
  drawCenterHalo();

  if (state.mode === 'paper') {
    drawPaperMode();
  } else {
    const points = computePoints(state.t);
    drawGhosts(state.t);
    drawGuides(points);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (state.mode === 'sculpture') drawSculpture(points);
    else if (state.mode === 'courbes') drawCourbes(points);
    else if (state.mode === 'mirror') drawMirror(points);
    else if (state.mode === 'multi') drawMulti(points);
    else if (state.mode === 'continu') drawContinu(points);
    ctx.restore();
    drawNodes(points);
  }

  requestAnimationFrame(frame);
}
frame.last = performance.now();

function toggleUi() {
  ui.classList.toggle('hidden');
  const hidden = ui.classList.contains('hidden');
  togglePanel.textContent = hidden ? 'afficher panneau' : 'masquer panneau';
  collapseBtn.textContent = hidden ? '⟶ panneau' : '⟵ panneau';
  clearAll();
}

function stepBuild(delta) {
  sliders.buildStep.value = String(clamp(n('buildStep') + delta, 0, 4));
  updateVals();
  clearAll();
}

function stepPhase(delta) {
  sliders.phase.value = String(clamp(n('phase') + delta, 0, 1).toFixed(3));
  updateVals();
  clearAll();
}

addEventListener('resize', resize, { passive: true });
ids.forEach(id => sliders[id]?.addEventListener('input', () => { updateVals(); clearAll(); }));
modeChips.forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
paperChips.forEach(button => button.addEventListener('click', () => setPaperPreset(button.dataset.paper)));
layerChips.forEach(button => button.addEventListener('click', () => toggleLayer(button.dataset.layer)));

document.getElementById('stepModeBtn').addEventListener('click', event => {
  state.stepMode = !state.stepMode;
  event.currentTarget.classList.toggle('active', state.stepMode);
  event.currentTarget.textContent = state.stepMode ? 'Mode pas à pas' : 'Mode auto';
  clearAll();
});
document.getElementById('stepPrevBtn').addEventListener('click', () => stepBuild(-1));
document.getElementById('stepNextBtn').addEventListener('click', () => stepBuild(1));
document.getElementById('pauseBtn').addEventListener('click', event => {
  state.paused = !state.paused;
  event.currentTarget.classList.toggle('active', state.paused);
  event.currentTarget.textContent = state.paused ? 'Reprendre' : 'Pause';
});
document.getElementById('resetBtn').addEventListener('click', () => { state.zoom = 1; state.yaw = 0.18; state.pitch = 0.55; clearAll(); });
document.getElementById('flatBtn').addEventListener('click', () => { sliders.depth.value = 0; sliders.tilt.value = 0; state.yaw = 0; state.pitch = 0; state.zoom = 1; updateVals(); clearAll(); });
document.getElementById('guidesBtn').addEventListener('click', event => { state.guides = !state.guides; event.currentTarget.classList.toggle('active', state.guides); clearAll(); });
document.getElementById('nodesBtn').addEventListener('click', event => { state.nodes = !state.nodes; event.currentTarget.classList.toggle('active', state.nodes); clearAll(); });
document.getElementById('ghostBtn').addEventListener('click', event => { state.ghost = !state.ghost; event.currentTarget.classList.toggle('active', state.ghost); clearAll(); });
togglePanel.addEventListener('click', toggleUi);
collapseBtn.addEventListener('click', toggleUi);

canvas.addEventListener('pointerdown', event => {
  state.dragging = true;
  state.lx = event.clientX;
  state.ly = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!state.dragging) return;
  const dx = event.clientX - state.lx;
  const dy = event.clientY - state.ly;
  state.lx = event.clientX;
  state.ly = event.clientY;
  state.yaw += dx * 0.006;
  state.pitch = clamp(state.pitch + dy * 0.006, -1.25, 1.25);
});
canvas.addEventListener('pointerup', event => {
  state.dragging = false;
  try { canvas.releasePointerCapture(event.pointerId); } catch {}
});
canvas.addEventListener('wheel', event => {
  if (event.target.closest('.nl-panel')) return;
  event.preventDefault();
  state.zoom = clamp(state.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.45, 2.3);
  clearAll();
}, { passive: false });

ids.forEach(id => {
  const slider = sliders[id];
  if (!slider) return;
  slider.addEventListener('wheel', event => {
    event.preventDefault();
    event.stopPropagation();
    const step = Number(slider.step || 1);
    const min = Number(slider.min);
    const max = Number(slider.max);
    const dir = event.deltaY > 0 ? -1 : 1;
    const next = clamp(Number(slider.value) + step * dir, min, max);
    slider.value = String(Number.isInteger(step) ? Math.round(next) : Number(next.toFixed(4)));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: false });
});

addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (event.key === ' ') { event.preventDefault(); document.getElementById('pauseBtn').click(); }
  if (key === 'g') document.getElementById('guidesBtn').click();
  if (key === 'n') document.getElementById('nodesBtn').click();
  if (key === 'f') document.getElementById('ghostBtn').click();
  if (key === 'h') toggleUi();
  if (key === 'm') setMode('mirror');
  if (key === 'u') setMode('multi');
  if (key === 'c') setMode('continu');
  if (key === 's') setMode('sculpture');
  if (key === 'v') setMode('courbes');
  if (key === 'k') setMode('paper');
  if (key === 'x') { setMode('paper'); setPaperPreset('cube'); }
  if (key === 'a') { setMode('paper'); setPaperPreset('arith'); }
  if (key === 'o') { setMode('paper'); setPaperPreset('ortho'); }
  if (key === 'p') { setMode('paper'); setPaperPreset('spiral'); }
  if (key === 'b') document.getElementById('stepModeBtn').click();
  if (event.key === '[') stepBuild(-1);
  if (event.key === ']') stepBuild(1);
  if (event.key === ',') stepPhase(-0.03);
  if (event.key === '.') stepPhase(0.03);
  if (/^[1-6]$/.test(event.key)) setMode(['sculpture', 'courbes', 'mirror', 'multi', 'continu', 'paper'][Number(event.key) - 1]);
});

resize();
updateVals();
requestAnimationFrame(frame);
