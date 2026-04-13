/* ================================================================
   Strand Connection System — Death Stranding bridge metaphor
   Cubic Bézier, high-res sampling, layered glow + bundle offset.
   Layout targets can rebuild with eased anchor transition (no snap).
   ================================================================ */

const canvas = document.getElementById('strandCanvas');
if (!canvas) throw new Error('No #strandCanvas');
const ctx = canvas.getContext('2d', { alpha: true });

const dpr = Math.min(window.devicePixelRatio || 1, 2);
let W, H;

let hubTargetX = 0;
let hubTargetY = 0;
let hubX = 0;
let hubY = 0;

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  W = rect.width;
  H = rect.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
}

const menuItems = document.querySelectorAll('.menu-item');
const heroEl = document.getElementById('hero');
let strands = [];
let hoveredIndex = -1;
let growProgress = 0;
let startTime = performance.now();
const GROW_DUR = 2000;
const CURVE_STEPS = 72;
const ANCHOR_SMOOTH = 0.14;

/** Periodic layout rebuild → eased transition (ms) */
const REBUILD_INTERVAL_MS = 2800;
const REBUILD_DURATION_MS = 620;
let lastScheduledRebuild = 0;

const menuItemList = Array.from(menuItems);

/**
 * Active anchor transition: frozen from/to snapshots; DOM not read mid-flight.
 * @type {{
 *   startMs: number,
 *   duration: number,
 *   fromHub: {x:number,y:number},
 *   toHub: {x:number,y:number},
 *   fromEnds: {x:number,y:number}[],
 *   toEnds: {x:number,y:number}[]
 * } | null}
 */
let anchorTransition = null;

function bezierPoint(ax, ay, c1x, c1y, c2x, c2y, bx, by, tt) {
  const u = 1 - tt;
  const tt2 = tt * tt;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt2 * tt;
  return {
    x: uuu * ax + 3 * uu * tt * c1x + 3 * u * tt2 * c2x + ttt * bx,
    y: uuu * ay + 3 * uu * tt * c1y + 3 * u * tt2 * c2y + ttt * by,
  };
}

function sampleBezier(ax, ay, c1x, c1y, c2x, c2y, bx, by, tMax) {
  if (tMax <= 0) {
    return [bezierPoint(ax, ay, c1x, c1y, c2x, c2y, bx, by, 0)];
  }
  const pts = [];
  const n = Math.max(2, Math.ceil(CURVE_STEPS * tMax) + 1);
  for (let i = 0; i < n; i++) {
    const tt = (i / (n - 1)) * tMax;
    pts.push(bezierPoint(ax, ay, c1x, c1y, c2x, c2y, bx, by, tt));
  }
  return pts;
}

function polylineNormals(pts) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    out.push({ x: -dy / len, y: dx / len });
  }
  return out;
}

function offsetPolyline(pts, norms, off) {
  return pts.map((p, i) => ({
    x: p.x + norms[i].x * off,
    y: p.y + norms[i].y * off,
  }));
}

function strokePolyline(pts, lineWidth, strokeStyle, shadowBlur, shadowColor) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowColor = shadowColor || strokeStyle;
  ctx.stroke();
  ctx.restore();
}

function syncTargetsFromDom() {
  if (!heroEl) return;
  const heroRect = heroEl.getBoundingClientRect();
  const originEl = document.querySelector('.strand-origin');
  if (originEl) {
    const r = originEl.getBoundingClientRect();
    hubTargetX = r.left + r.width / 2 - heroRect.left;
    hubTargetY = r.top + r.height / 2 - heroRect.top;
  } else {
    hubTargetX = W / 2;
    hubTargetY = H * 0.38;
  }

  menuItemList.forEach((item, i) => {
    if (!strands[i]) return;
    const r = item.getBoundingClientRect();
    strands[i].tTx = r.left + r.width / 2 - heroRect.left;
    strands[i].tTy = r.top + r.height / 2 - heroRect.top;
  });
}

function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
}

/**
 * Capture current drawn anchors + fresh DOM, then ease hub + endpoints to new layout.
 * Skips if movement is negligible.
 */
function beginAnchorRebuildTransition() {
  if (!strands.length || !heroEl || anchorTransition) return;

  const fromHub = { x: hubX, y: hubY };
  const fromEnds = strands.map((s) => ({ x: s.tx, y: s.ty }));

  syncTargetsFromDom();
  const toHub = { x: hubTargetX, y: hubTargetY };
  const toEnds = strands.map((s) => ({ x: s.tTx, y: s.tTy }));

  let maxD = Math.hypot(toHub.x - fromHub.x, toHub.y - fromHub.y);
  for (let i = 0; i < fromEnds.length; i++) {
    maxD = Math.max(maxD, Math.hypot(toEnds[i].x - fromEnds[i].x, toEnds[i].y - fromEnds[i].y));
  }
  if (maxD < 0.35) return;

  anchorTransition = {
    startMs: performance.now(),
    duration: REBUILD_DURATION_MS,
    fromHub,
    toHub,
    fromEnds,
    toEnds,
  };
}

/** Returns true while a transition is in progress. */
function stepAnchorTransition(now) {
  if (!anchorTransition) return false;
  const tr = anchorTransition;
  let p = (now - tr.startMs) / tr.duration;
  if (p >= 1) {
    hubX = tr.toHub.x;
    hubY = tr.toHub.y;
    hubTargetX = tr.toHub.x;
    hubTargetY = tr.toHub.y;
    for (let i = 0; i < strands.length; i++) {
      const te = tr.toEnds[i];
      strands[i].ox = hubX;
      strands[i].oy = hubY;
      strands[i].tx = te.x;
      strands[i].ty = te.y;
      strands[i].tTx = te.x;
      strands[i].tTy = te.y;
    }
    anchorTransition = null;
    syncTargetsFromDom();
    return false;
  }
  const e = easeInOutCubic(p);
  hubX = tr.fromHub.x + (tr.toHub.x - tr.fromHub.x) * e;
  hubY = tr.fromHub.y + (tr.toHub.y - tr.fromHub.y) * e;
  for (let i = 0; i < strands.length; i++) {
    const f = tr.fromEnds[i];
    const t = tr.toEnds[i];
    strands[i].ox = hubX;
    strands[i].oy = hubY;
    strands[i].tx = f.x + (t.x - f.x) * e;
    strands[i].ty = f.y + (t.y - f.y) * e;
  }
  return true;
}

function buildStrands() {
  resize();
  if (!heroEl) return;
  const heroRect = heroEl.getBoundingClientRect();
  const originEl = document.querySelector('.strand-origin');
  if (originEl) {
    const r = originEl.getBoundingClientRect();
    hubTargetX = r.left + r.width / 2 - heroRect.left;
    hubTargetY = r.top + r.height / 2 - heroRect.top;
  } else {
    hubTargetX = W / 2;
    hubTargetY = H * 0.38;
  }
  hubX = hubTargetX;
  hubY = hubTargetY;
  anchorTransition = null;

  strands = menuItemList.map((item) => {
    const r = item.getBoundingClientRect();
    const tx = r.left + r.width / 2 - heroRect.left;
    const ty = r.top + r.height / 2 - heroRect.top;
    return {
      ox: hubTargetX,
      oy: hubTargetY,
      tx,
      ty,
      tTx: tx,
      tTy: ty,
      phase: Math.random() * Math.PI * 2,
      freq: 0.22 + Math.random() * 0.18,
      freq2: 0.16 + Math.random() * 0.14,
      amp: 7 + Math.random() * 9,
      width: 1.0 + Math.random() * 0.35,
      bend: Math.random() < 0.5 ? -1 : 1,
    };
  });
}

menuItemList.forEach((item, i) => {
  item.addEventListener('mouseenter', () => {
    hoveredIndex = i;
  });
  item.addEventListener('mouseleave', () => {
    hoveredIndex = -1;
  });
});

function smoothAnchors() {
  hubX += (hubTargetX - hubX) * ANCHOR_SMOOTH;
  hubY += (hubTargetY - hubY) * ANCHOR_SMOOTH;
  for (let i = 0; i < strands.length; i++) {
    const s = strands[i];
    s.ox = hubX;
    s.oy = hubY;
    s.tx += (s.tTx - s.tx) * ANCHOR_SMOOTH;
    s.ty += (s.tTy - s.ty) * ANCHOR_SMOOTH;
  }
}

function drawStrand(s, i, timeSec, progress) {
  const dx = s.tx - s.ox;
  const dy = s.ty - s.oy;
  const len = Math.max(Math.hypot(dx, dy), 1);
  const nx = -dy / len;
  const ny = dx / len;
  const sag = Math.min(len * 0.19, 52) * s.bend;

  const wob = Math.sin(timeSec * s.freq + s.phase);
  const wob2 = Math.sin(timeSec * s.freq2 * 1.3 + s.phase * 1.4);
  const sway1 = (wob * 0.72 + wob2 * 0.28) * s.amp * progress;
  const sway2 = (Math.cos(timeSec * s.freq2 + s.phase * 1.7) * 0.55 + wob * 0.2) * s.amp * progress;

  const c1x = s.ox + dx * 0.26 + nx * (sag + sway1) * 0.88;
  const c1y = s.oy + dy * 0.1 + ny * (sag + sway1) * 0.88;
  const c2x = s.ox + dx * 0.74 + nx * (-sag * 0.34 + sway2);
  const c2y = s.oy + dy * 0.78 + ny * (-sag * 0.34 + sway2);

  const pts = sampleBezier(s.ox, s.oy, c1x, c1y, c2x, c2y, s.tx, s.ty, progress);
  if (pts.length < 2) return;

  const tip = pts[pts.length - 1];
  const norms = polylineNormals(pts);
  const bundle = 1.35 + 0.35 * Math.sin(timeSec * 0.6 + s.phase);
  const sideA = offsetPolyline(pts, norms, bundle);
  const sideB = offsetPolyline(pts, norms, -bundle);

  const isHovered = i === hoveredIndex;
  const isAnyHovered = hoveredIndex !== -1;

  let baseA = isHovered ? 0.78 : isAnyHovered ? 0.28 : 0.4;
  if (isHovered) baseA += Math.sin(timeSec * 1.8 + s.phase) * 0.06;
  baseA *= Math.min(progress * 1.12, 1);

  const lw = isHovered ? s.width * 2.1 : s.width * 1.05;

  const drawCable = (path, widthMul, aMul, blur, col, shCol) => {
    strokePolyline(
      path,
      lw * widthMul,
      col.replace('__A__', String(baseA * aMul)),
      blur,
      shCol
    );
  };

  drawCable(pts, 1, 1, isHovered ? 18 : 12, `rgba(55, 78, 118, __A__)`, 'rgba(70, 95, 140, 0.4)');
  drawCable(sideA, 0.92, 0.55, isHovered ? 10 : 6, `rgba(180, 140, 100, __A__)`, 'rgba(200, 160, 120, 0.35)');
  drawCable(sideB, 0.92, 0.55, isHovered ? 10 : 6, `rgba(180, 140, 100, __A__)`, 'rgba(200, 160, 120, 0.35)');
  drawCable(pts, 1, 0.38, isHovered ? 14 : 8, `rgba(200, 155, 107, __A__)`, 'rgba(210, 170, 125, 0.45)');
  drawCable(pts, 0.82, 0.88, 0, `rgba(232, 205, 175, __A__)`, 'transparent');
  drawCable(pts, 0.38, 0.45, 0, `rgba(255, 250, 240, __A__)`, 'transparent');

  if (progress > 0.94 && tip) {
    const dotA = isHovered ? 0.92 : isAnyHovered ? 0.32 : 0.5;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, isHovered ? 5.5 : 4.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 155, 107, ${dotA * 0.14})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, isHovered ? 2.9 : 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235, 210, 180, ${dotA})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 252, 248, ${dotA * 0.8})`;
    ctx.fill();
  }
}

function drawHub(timeSec, progress) {
  const p = Math.min(progress * 1.15, 1);
  const pulse = 0.9 + 0.1 * Math.sin(timeSec * 1.9);
  ctx.beginPath();
  ctx.arc(hubX, hubY, 19 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(200, 155, 107, ${0.09 * p})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hubX, hubY, 8.5 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(200, 155, 107, ${0.055 * p})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

let visible = true;
const obs = new IntersectionObserver(
  (entries) => {
    visible = entries[0].isIntersecting;
  },
  { threshold: 0 }
);
obs.observe(canvas);

function loop() {
  requestAnimationFrame(loop);
  if (!visible || strands.length === 0) return;

  const now = performance.now();
  const timeSec = now * 0.001;

  const transitioning = stepAnchorTransition(now);
  if (!transitioning && !anchorTransition) {
    syncTargetsFromDom();
    smoothAnchors();
  }

  if (!anchorTransition && now - lastScheduledRebuild >= REBUILD_INTERVAL_MS) {
    lastScheduledRebuild = now;
    beginAnchorRebuildTransition();
  }

  const raw = Math.min((now - startTime) / GROW_DUR, 1);
  growProgress = 1 - (1 - raw) ** 3;

  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < strands.length; i++) {
    drawStrand(strands[i], i, timeSec, growProgress);
  }
  drawHub(timeSec, growProgress);
}

function onResize() {
  const prevN = strands.length;
  resize();
  if (strands.length === 0 || prevN !== menuItemList.length) {
    buildStrands();
  } else {
    beginAnchorRebuildTransition();
  }
}

window.addEventListener('resize', onResize);
if (heroEl && typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => {
    onResize();
  });
  ro.observe(heroEl);
}

setTimeout(() => {
  buildStrands();
  startTime = performance.now();
  lastScheduledRebuild = performance.now();
  loop();
}, 300);

export { buildStrands, beginAnchorRebuildTransition };
