// WebGL2 host for shader.frag with live reload.

const GRID = 16;
const MARGIN = 1.2;                 // must match MARGIN in shader.frag
const SPAN = GRID + 2 * MARGIN;
const DISPLAY_VIEW = [64, 64];      // display view world size (w, h), must match DISPLAY_SIZE in shader.frag

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

const gl = glCanvas.getContext('webgl2');
if (!gl) throw new Error('WebGL2 not supported');

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

let program = null;
let uRes = null, uMouse = null, uStep = null, uEdit = null;

// View: "display" (default) shows only the triangle; "edit" (?edit, or press E)
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
let steps = [];            // [{ n, text }] parsed from "// Step N: text" comments
let maxStep = Infinity;    // show steps 0..maxStep
const stepListEl = document.getElementById('stepList');
let mouse = [-100, -100];
let cssSize = 0;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log);
  }
  return s;
}

function buildProgram(fragSrc) {
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

async function loadShader() {
  const src = await (await fetch('shader.frag?t=' + Date.now(), { cache: 'no-store' })).text();
  try {
    const p = buildProgram(src);
    if (program) gl.deleteProgram(program);
    program = p;
    uRes = gl.getUniformLocation(program, 'u_resolution');
    uMouse = gl.getUniformLocation(program, 'u_mouse');
    uStep = gl.getUniformLocation(program, 'u_step');
    uEdit = gl.getUniformLocation(program, 'u_edit');
    steps = [...src.matchAll(/^[ \t]*\/\/[ \t]*Step[ \t]+(\d+)[ \t]*:[ \t]*(.*)$/gm)]
      .map((m) => ({ n: Number(m[1]), text: m[2].trim() }))
      .sort((a, b) => a.n - b.n);
    renderSteps();
    errorEl.style.display = 'none';
    reloadEl.textContent = 'shader: compiled ' + new Date().toLocaleTimeString();
    console.log('[tile] shader compiled');
  } catch (e) {
    // keep the last good program running, show the error
    errorEl.textContent = 'shader.frag failed to compile:\n\n' + e.message;
    errorEl.style.display = 'block';
    reloadEl.textContent = 'shader: ERROR (showing last good version)';
    console.error('[tile] shader error\n' + e.message);
  }
  draw();
}

// ---- layout ----

function gridToCss(x, y) {
  return [(x + MARGIN) / SPAN * cssSize, (1 - (y + MARGIN) / SPAN) * cssSize];
}

function resize() {
  // edit view: leave room for the 260px step panel + gaps on the right, status bar below
  // display view: fit the DISPLAY_VIEW aspect ratio into the window
  let w, h;
  if (edit) {
    cssSize = Math.floor(Math.min(window.innerWidth - 24 - 276, window.innerHeight - 70));
    w = h = cssSize;
  } else {
    const [vw, vh] = DISPLAY_VIEW;
    const s = Math.min((window.innerWidth - 24) / vw, (window.innerHeight - 24) / vh);
    w = Math.floor(vw * s);
    h = Math.floor(vh * s);
    cssSize = h;
  }
  const dpr = window.devicePixelRatio || 1;
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  for (const c of [glCanvas, overlay]) {
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
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
  if (!program) return;
  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  gl.useProgram(program);
  gl.uniform2f(uRes, glCanvas.width, glCanvas.height);
  gl.uniform2f(uMouse, mouse[0], mouse[1]);
  gl.uniform1i(uStep, Number.isFinite(maxStep) ? maxStep : 9999);
  gl.uniform1i(uEdit, edit ? 1 : 0);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ---- mouse ----

stage.addEventListener('mousemove', (e) => {
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
