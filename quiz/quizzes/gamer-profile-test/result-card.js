const COLORS = {
  background: '#090b12',
  panel: '#151a29',
  grid: '#384158',
  text: '#f4f1e8',
  muted: '#a8afc2',
  square: '#ffca58',
  round: '#6ee7f2',
};

function polygonPoint(centerX, centerY, radius, index, count) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
}

function drawPolygon(ctx, centerX, centerY, radius, count) {
  ctx.beginPath();
  for (let index = 0; index < count; index += 1) {
    const point = polygonPoint(centerX, centerY, radius, index, count);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

export function drawRadar(ctx, axes, scores, bounds) {
  const { centerX, centerY, radius } = bounds;
  ctx.save();
  ctx.lineWidth = 2;
  [0.25, 0.5, 0.75, 1].forEach((step) => {
    drawPolygon(ctx, centerX, centerY, radius * step, axes.length);
    ctx.strokeStyle = COLORS.grid;
    ctx.stroke();
  });

  axes.forEach((axis, index) => {
    const outer = polygonPoint(centerX, centerY, radius, index, axes.length);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(outer.x, outer.y);
    ctx.strokeStyle = COLORS.grid;
    ctx.stroke();

    const label = polygonPoint(centerX, centerY, radius + 42, index, axes.length);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = label.x < centerX - 10 ? 'right' : label.x > centerX + 10 ? 'left' : 'center';
    ctx.textBaseline = label.y < centerY ? 'bottom' : 'top';
    ctx.fillText(axis.shortLabel || axis.label, label.x, label.y);
    ctx.fillStyle = COLORS.round;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(`${scores[axis.id]} %`, label.x, label.y + (label.y < centerY ? -26 : 27));
  });

  ctx.beginPath();
  axes.forEach((axis, index) => {
    const point = polygonPoint(centerX, centerY, radius * (scores[axis.id] / 100), index, axes.length);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(110, 231, 242, .22)';
  ctx.strokeStyle = COLORS.round;
  ctx.lineWidth = 5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 6) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return y + Math.min(lines.length, maxLines) * lineHeight;
}

function fitText(ctx, text, maxWidth, startSize, weight = 900, minimumSize = 30) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    size -= 2;
  } while (ctx.measureText(text).width > maxWidth && size >= minimumSize);
}

export function renderVisibleRadar(canvas, axes, scores) {
  if (!canvas) return;
  canvas.width = 760;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRadar(ctx, axes, scores, { centerX: 380, centerY: 270, radius: 165 });
}

export function createResultImage({ displayName, versionLabel, resultProfile, scores, axes, insight }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 1200, 1500);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(1, COLORS.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 3;
  ctx.strokeRect(42, 42, 1116, 1416);

  ctx.fillStyle = COLORS.round;
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(`STERENNA · PLAYER LAB · ${versionLabel}`, 82, 105);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = COLORS.text;
  fitText(ctx, displayName, 1035, 62);
  ctx.fillText(displayName, 82, 190);
  ctx.fillStyle = COLORS.square;
  fitText(ctx, resultProfile.name, 1035, 52);
  ctx.fillText(resultProfile.name, 82, 260);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.fillText(`${resultProfile.level} · ${scores.carre} % Carré · ${scores.rond} % Rond`, 82, 315);

  ctx.fillStyle = COLORS.panel;
  ctx.beginPath();
  ctx.roundRect(74, 360, 1052, 700, 28);
  ctx.fill();
  drawRadar(ctx, axes, scores.axes, { centerX: 600, centerY: 690, radius: 235 });

  ctx.fillStyle = COLORS.text;
  ctx.font = '700 30px system-ui, sans-serif';
  const afterInsight = wrapText(ctx, insight.text, 82, 1130, 1035, 43, 5);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '500 24px system-ui, sans-serif';
  wrapText(ctx, 'Test humoristique : ce résultat décrit des habitudes, pas une vérité psychométrique.', 82, afterInsight + 38, 1035, 34, 3);
  ctx.fillStyle = COLORS.round;
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText('nitro.sterenna.fr/quiz/', 82, 1410);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Création du PNG impossible'))), 'image/png');
  });
}
