// Tile sandbox page: editing view (grid, labels, step list) and display view
// (the kaleidoscope tiling), with live reload. WebGL lives in renderer.js.

// Editing view window (grid units): zoomed out so every shape is seen whole.
// Widen it whenever a new shape reaches past it.
//   the triangle: x 0..16, y 0..16
//   step 1, circle (-2.3,6) r=8.8: x -11.1..6.5, y -2.8..14.8
//   step 2, circle (-1.8,-0.1) r=11.2: x -13..9.4, y -11.3..11.1
//   step 3, circle A(0,0) r=9: x -9..9, y -9..9 (fits)
//   step 4, rectangle (8,0) to (8.5,8) (fits)
//   step 5, circle A(0,0) r=6 (fits)
//   step 6, triangle (6,0) (9.5,0) (9.5,4.2) (fits)
//   step 7, rectangle (9,0) to (9.5,8) (fits)
//   step 8, triangle (7,0) (9.5,0) (9.5,3.3) (fits)
//   step 9, triangle (8,0) (9.5,0) (9.5,2) (fits)
//   step 10, circle A(0,0) r=3 (fits)
//   step 11, circle (13,-4.1) r=5.8: x 7.2..18.8, y -9.9..1.7
//   step 12, circle (18.3,6.5) r=8: x 10.3..26.3, y -1.5..14.5
//   step 13, circle (4.65,9.25) r=1.05 (fits)
//   step 14, circle (3.4,10.05) r=0.5 (fits)
//   step 15, circle (2.1,10.7) r=1 (fits)
//   step 16, circle (0.8,10.95) r=0.4 (fits)
//   step 17, circle (0.25,10.85) r=0.3 (fits)
//   step 18, rectangle (2.5,12) to (4,13) (fits)
//   step 19, rectangle (0,13) to (3,13.5) (fits)
//   steps 20-21, circles B(16,0) r=1.5 and r=1 (fit)
const EDIT_MIN = [-14.5, -12.5];
const EDIT_MAX = [28, 17];
const EDIT_SIZE = [EDIT_MAX[0] - EDIT_MIN[0], EDIT_MAX[1] - EDIT_MIN[1]];
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
const meltEl = document.getElementById('melt');
const meltValEl = document.getElementById('meltV');

const renderer = createRenderer(glCanvas);

let steps = [];            // [{ n, text }] parsed from "// Step N: text" comments
let maxStep = Infinity;    // show steps 0..maxStep
let mouse = [-100, -100];
let cssW = 0, cssH = 0;

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
  return [(x - EDIT_MIN[0]) / EDIT_SIZE[0] * cssW, (1 - (y - EDIT_MIN[1]) / EDIT_SIZE[1]) * cssH];
}

function resize() {
  if (edit) {
    // fit the window's shape into the space left of the 260px step panel, above the status bar
    const scale = Math.min((window.innerWidth - 24 - 276) / EDIT_SIZE[0], (window.innerHeight - 70) / EDIT_SIZE[1]);
    cssW = Math.floor(EDIT_SIZE[0] * scale);
    cssH = Math.floor(EDIT_SIZE[1] * scale);
  } else {
    cssW = cssH = Math.floor(Math.min(window.innerWidth, window.innerHeight) - 24);
  }
  const dpr = window.devicePixelRatio || 1;
  stage.style.width = cssW + 'px';
  stage.style.height = cssH + 'px';
  for (const c of [glCanvas, overlay]) {
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
  }
  drawOverlay();
  draw();
}

function drawOverlay() {
  const ctx = overlay.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const unit = cssW / EDIT_SIZE[0];

  // numbers along the axes (every 2 units when they'd be cramped)
  const every = unit < 22 ? 2 : 1;
  ctx.fillStyle = '#9a9a9a';
  ctx.font = `${Math.max(9, Math.min(unit * 0.42, 13))}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = Math.ceil(EDIT_MIN[0]) + 1; i < EDIT_MAX[0]; i++) {   // not on the window's edges
    if (i % every || i === 0) continue;
    const [x, y] = gridToCss(i, -0.45);              // under the x axis
    ctx.fillText(String(i), x, y);
  }
  for (let i = Math.ceil(EDIT_MIN[1]) + 1; i < EDIT_MAX[1]; i++) {
    if (i % every || i === 0) continue;
    const [x, y] = gridToCss(-0.5, i);               // left of the y axis
    ctx.fillText(String(i), x, y);
  }

  ctx.fillStyle = '#7fb0ff';
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
    u_viewMin: edit ? EDIT_MIN : DISPLAY_MIN,
    u_viewSize: edit ? EDIT_SIZE : DISPLAY_SIZE,
    u_melt: Number(meltEl.value),
  });
}

// melt: how much the shapes blend into one another (smooth union / cut)
meltEl.oninput = () => { meltValEl.textContent = meltEl.value; draw(); };
{ const m = new URLSearchParams(location.search).get('melt');   // ?melt=0.5 starts there
  if (m !== null) { meltEl.value = m; meltValEl.textContent = meltEl.value; } }

// ---- mouse ----

stage.addEventListener('mousemove', (e) => {
  if (!edit) return;
  const r = glCanvas.getBoundingClientRect();
  const gx = EDIT_MIN[0] + (e.clientX - r.left) / r.width * EDIT_SIZE[0];
  const gy = EDIT_MIN[1] + (1 - (e.clientY - r.top) / r.height) * EDIT_SIZE[1];
  mouse = [gx, gy];
  hoverEl.textContent = `(${Math.round(gx)}, ${Math.round(gy)})`;
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
