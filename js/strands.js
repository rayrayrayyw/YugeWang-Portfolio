/* ================================================================
   Strand Connection System — Death Stranding "bridge" metaphor
   Bezier curves from a central node to each menu item,
   with physics sway, growth animation, and hover glow.
   ================================================================ */

const canvas = document.getElementById('strandCanvas');
if (!canvas) throw new Error('No #strandCanvas');
const ctx = canvas.getContext('2d');

const dpr = Math.min(window.devicePixelRatio || 1, 2);
let W, H;

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  W = rect.width;
  H = rect.height;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ---------- strand data ---------- */
const menuItems   = document.querySelectorAll('.menu-item');
const heroEl      = document.getElementById('hero');
let strands       = [];
let hoveredIndex  = -1;
let growProgress  = 0;  // 0→1 on load
let startTime     = performance.now();
const GROW_DUR    = 1800; // ms

function buildStrands() {
  resize();
  const heroRect = heroEl.getBoundingClientRect();

  // origin: center below the title
  const originEl = document.querySelector('.strand-origin');
  let ox, oy;
  if (originEl) {
    const r = originEl.getBoundingClientRect();
    ox = r.left + r.width / 2 - heroRect.left;
    oy = r.top + r.height / 2 - heroRect.top;
  } else {
    ox = W / 2;
    oy = H * 0.38;
  }

  strands = [];
  menuItems.forEach((item, i) => {
    const r = item.getBoundingClientRect();
    const tx = r.left + r.width / 2 - heroRect.left;
    const ty = r.top  + r.height / 2 - heroRect.top;
    strands.push({
      ox, oy, tx, ty,
      phase: Math.random() * Math.PI * 2,
      freq:  0.4 + Math.random() * 0.3,
      amp:   12 + Math.random() * 18,
      width: 1.0 + Math.random() * 0.6,
    });
  });
}

/* ---------- hover ---------- */
menuItems.forEach((item, i) => {
  item.addEventListener('mouseenter', () => { hoveredIndex = i; });
  item.addEventListener('mouseleave', () => { hoveredIndex = -1; });
});

/* ---------- draw one strand ---------- */
function drawStrand(s, i, t) {
  const progress = Math.min(growProgress, 1);
  const dx = s.tx - s.ox;
  const dy = s.ty - s.oy;

  // current endpoint (grows from origin)
  const ex = s.ox + dx * progress;
  const ey = s.oy + dy * progress;

  // sway offset at control point
  const sway = Math.sin(t * s.freq + s.phase) * s.amp * progress;
  const cpx = (s.ox + ex) / 2 + sway;
  const cpy = (s.oy + ey) / 2 - Math.abs(dy) * 0.15;

  const isHovered = (i === hoveredIndex);
  const isAnyHovered = (hoveredIndex !== -1);

  // base alpha
  let alpha = isHovered ? 0.7 : (isAnyHovered ? 0.1 : 0.3);
  // pulse on hovered strand
  if (isHovered) {
    alpha += Math.sin(t * 4) * 0.15;
  }
  alpha *= progress;

  const lw = isHovered ? s.width * 2.2 : s.width;

  // glow layer
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(s.ox, s.oy);
  ctx.quadraticCurveTo(cpx, cpy, ex, ey);
  ctx.strokeStyle = `rgba(200, 155, 110, ${alpha * 0.3})`;
  ctx.lineWidth = lw + 4;
  ctx.shadowColor = 'rgba(200, 150, 110, 0.4)';
  ctx.shadowBlur = isHovered ? 18 : 6;
  ctx.stroke();
  ctx.restore();

  // core line
  ctx.beginPath();
  ctx.moveTo(s.ox, s.oy);
  ctx.quadraticCurveTo(cpx, cpy, ex, ey);
  ctx.strokeStyle = `rgba(210, 165, 120, ${alpha})`;
  ctx.lineWidth = lw;
  ctx.stroke();

  // origin node glow
  if (i === 0) {
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, 3 + Math.sin(t * 2) * 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210, 165, 120, ${0.5 * progress})`;
    ctx.fill();
  }

  // endpoint dot
  if (progress > 0.95) {
    const dotAlpha = isHovered ? 0.9 : (isAnyHovered ? 0.15 : 0.4);
    const dotR = isHovered ? 3 : 2;
    ctx.beginPath();
    ctx.arc(ex, ey, dotR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210, 165, 120, ${dotAlpha})`;
    ctx.fill();
  }
}

/* ---------- animation loop ---------- */
let visible = true;
const obs = new IntersectionObserver(
  (entries) => { visible = entries[0].isIntersecting; },
  { threshold: 0 }
);
obs.observe(canvas);

let lastBuild = 0;
function loop() {
  requestAnimationFrame(loop);
  if (!visible || strands.length === 0) return;

  const now = performance.now();
  const t   = now * 0.001;

  // rebuild positions periodically (resize/scroll)
  if (now - lastBuild > 500) {
    buildStrands();
    lastBuild = now;
  }

  const raw = Math.min((now - startTime) / GROW_DUR, 1);
  growProgress = 1 - Math.pow(1 - raw, 3); // ease-out cubic

  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < strands.length; i++) {
    drawStrand(strands[i], i, t);
  }
}

/* ---------- init ---------- */
window.addEventListener('resize', () => { resize(); buildStrands(); });

// wait for fonts/layout
setTimeout(() => {
  buildStrands();
  startTime = performance.now();
  loop();
}, 300);

export { buildStrands };
