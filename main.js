// Tile sandbox page: editing view (grid, labels, step list) and display view
// (the kaleidoscope tiling), with live reload. WebGL lives in renderer.js.

const GRID = 16;
const MARGIN = 1.2;                 // must match MARGIN in shader.frag
const SPAN = GRID + 2 * MARGIN;
const DISPLAY_MIN = [-32, -32];     // display view world window (grid units)
const DISPLAY_SIZE = [64, 64];

// Named points drawn as labels on the overlay. Add entries as the pattern grows.
const LABELS = [
  { name: 'A', x: 0,  y: 0,  dx: -0.55, dy: -0.55 },
  { name: 'B', x: 16, y: 0,  dx:  0.55, dy: -0.55 },
  { name: 'C', x: 0,  y: 16, dx: -0.55, dy:  0.55 },
];

const glCanvas = document.getElementById('gl');
const overlay = document.getElementById('overlay');
const stage = document.getElementById('stage');
const hoverEl = document.getElementById('hover');
const reloadEl = document.getElementById('reload');
const errorEl = document.getElementById('error');
const stepListEl = document.getElementById('stepList');

const renderer = createRenderer(glCanvas);

let steps = [];            // [{ n, text }] parsed from "// Step N: text" comments
let maxStep = Infinity;    // show steps 0..maxStep
let mouse = [-100, -100];
let cssSize = 0;

// View: "display" (default) shows only the pattern; "edit" (?edit, or press E)
// adds the grid, labels, hover readout and step list.
let edit = new URLSearchParams(location.search).has('edit');
function applyView() {
  document.body.classList.toggle('display', !edit);
  resize();
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'e' || e.key === 'E') {
    edit = !edit;
    if (!edit) maxStep = Infinity;   // the display always shows every step
    renderSteps();
    applyView();
  }
});

async function loadShader() {
  const src = await fetchShader();
  const err = renderer.load(src);
  if (err) {
    // the last good program keeps running; show the error
    errorEl.textContent = 'shader.frag failed to compile:\n\n' + err;
    errorEl.style.display = 'block';
    reloadEl.textContent = 'shader: ERROR (showing last good version)';
    console.error('[tile] shader error\n' + err);
  } else {
    steps = parseSteps(src);
    renderSteps();
    errorEl.style.display = 'none';
    reloadEl.textContent = 'shader: compiled ' + new Date().toLocaleTimeString();
    console.log('[tile] shader compiled');
  }
  draw();
}

// ---- layout ----

function gridToCss(x, y) {
  return [(x + MARGIN) / SPAN * cssSize, (1 - (y + MARGIN) / SPAN) * cssSize];
}

function resize() {
  // edit view: leave room for the 260px step panel + gaps on the right, status bar below
  cssSize = edit
    ? Math.floor(Math.min(window.innerWidth - 24 - 276, window.innerHeight - 70))
    : Math.floor(Math.min(window.innerWidth, window.innerHeight) - 24);
  const dpr = window.devicePixelRatio || 1;
  stage.style.width = stage.style.height = cssSize + 'px';
  for (const c of [glCanvas, overlay]) {
    c.style.width = c.style.height = cssSize + 'px';
    c.width = c.height = Math.round(cssSize * dpr);
  }
  drawOverlay();
  draw();
}

function drawOverlay() {
  const ctx = overlay.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  const unit = cssSize / SPAN;

  ctx.fillStyle = '#5a5955';
  ctx.font = `${Math.max(9, unit * 0.34)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= GRID; i++) {
    const [bx, by] = gridToCss(i, -0.45);           // x axis, under the square
    ctx.fillText(String(i), bx, by);
    const [lx, ly] = gridToCss(-0.45, i);           // y axis, left of the square
    ctx.fillText(String(i), lx, ly);
  }

  ctx.fillStyle = '#1a3f99';
  ctx.font = `bold ${Math.max(11, unit * 0.5)}px ui-sans-serif, system-ui, sans-serif`;
  for (const L of LABELS) {
    const [x, y] = gridToCss(L.x + L.dx, L.y + L.dy);
    ctx.fillText(L.name, x, y);
  }
}

function renderSteps() {
  stepListEl.innerHTML = '';
  for (const s of steps) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${s.n}</span>`;
    li.appendChild(document.createTextNode(s.text));
    if (s.n > maxStep) li.className = 'off';
    if (s.n === maxStep) li.className = 'current';
    li.onclick = () => {
      maxStep = maxStep === s.n ? Infinity : s.n;
      renderSteps();
      draw();
    };
    stepListEl.appendChild(li);
  }
}

function draw() {
  renderer.draw({
    u_mouse: mouse,
    u_step: Number.isFinite(maxStep) ? maxStep : 9999,
    u_fade: 1,
    u_edit: edit,
    u_fold: 4,
    u_viewMin: DISPLAY_MIN,
    u_viewSize: DISPLAY_SIZE,
  });
}

// ---- mouse ----

stage.addEventListener('mousemove', (e) => {
  if (!edit) return;
  const r = glCanvas.getBoundingClientRect();
  const gx = (e.clientX - r.left) / r.width * SPAN - MARGIN;
  const gy = (1 - (e.clientY - r.top) / r.height) * SPAN - MARGIN;
  mouse = [gx, gy];
  const sx = Math.round(gx), sy = Math.round(gy);
  const inGrid = sx >= 0 && sx <= GRID && sy >= 0 && sy <= GRID;
  hoverEl.textContent = inGrid ? `(${sx}, ${sy})` : '—';
  if (!inGrid) mouse = [-100, -100];
  draw();
});
stage.addEventListener('mouseleave', () => {
  mouse = [-100, -100];
  hoverEl.textContent = '—';
  draw();
});

// ---- live reload ----

const events = new EventSource('/events');
events.onmessage = (e) => {
  if (e.data === 'shader.frag') loadShader();
  else location.reload();
};

window.addEventListener('resize', resize);
applyView();
loadShader();
