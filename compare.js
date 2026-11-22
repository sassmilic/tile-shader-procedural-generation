// Compare: the original tile (shader.frag) next to pattern.frag, which draws it
// with circles, rectangles and triangles, with pattern.frag's full source below. Live reload.

const orig = { canvas: document.getElementById('orig'), file: 'shader.frag', label: document.getElementById('origLines') };
const test = { canvas: document.getElementById('test'), file: 'pattern.frag', label: document.getElementById('testLines') };
const sourceEl = document.getElementById('source');
const errorEl = document.getElementById('error');
for (const v of [orig, test]) v.renderer = createRenderer(v.canvas);

// the original's display view, same 64 x 64 window as pattern.frag
const ORIG_UNIFORMS = { u_step: 9999, u_fade: 1, u_edit: false, u_fold: 4,
                        u_viewMin: [-32, -32], u_viewSize: [64, 64], u_mouse: [-100, -100] };

const countLines = (src) => src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length;

async function load(v) {
  const src = await fetchShader(v.file);
  // pattern.frag is a Shadertoy-style program (mainImage); shader.frag is a full shader
  const err = v.renderer.load(v === test ? wrapShadertoy(src) : src);
  errorEl.style.display = err ? 'block' : 'none';
  if (err) { errorEl.textContent = v.file + ' failed to compile:\n\n' + err; return; }
  v.label.textContent = `${countLines(src)} lines`;
  if (v === test) sourceEl.textContent = src;
  draw(v);
}

const draw = (v) => v.renderer.draw(v === orig ? ORIG_UNIFORMS : {});

function resize() {
  const size = Math.floor(Math.max(200, Math.min((window.innerWidth - 56) / 2, window.innerHeight * 0.62)));
  const dpr = window.devicePixelRatio || 1;
  for (const v of [orig, test]) {
    v.canvas.style.width = v.canvas.style.height = size + 'px';
    v.canvas.width = v.canvas.height = Math.round(size * dpr);
    draw(v);
  }
}

onFileChange((name) => {
  if (name === orig.file) load(orig);
  else if (name === test.file) load(test);
  else location.reload();
});

window.addEventListener('resize', resize);
resize();
load(orig);
load(test);
