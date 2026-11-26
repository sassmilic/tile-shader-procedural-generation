// Compare: the original tile (shader.frag) next to pattern.frag, which draws it
// with circles, rectangles and triangles, with pattern.frag's full source below. Live reload.

const orig = { canvas: document.getElementById('orig'), file: 'shader.frag', label: document.getElementById('origLines') };
const test = { canvas: document.getElementById('test'), file: 'pattern.frag', label: document.getElementById('testLines') };
const sourceEl = document.getElementById('source');
const errorEl = document.getElementById('error');
const glowSelect = document.getElementById('glow');
const viewSelect = document.getElementById('view');
setupGlowSelect(glowSelect);
if (new URLSearchParams(location.search).get('zoom') === '4') viewSelect.value = '16';

for (const v of [orig, test]) v.renderer = createRenderer(v.canvas);

// the original's display view, same 64 x 64 window as pattern.frag
const ORIG_UNIFORMS = { u_step: 9999, u_fade: 1, u_edit: false, u_fold: 4,
                        u_mouse: [-100, -100] };

const countLines = (src) => src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length;

async function load(v) {
  v.source = await fetchShader(v.file);
  compile(v);
}

function compile(v) {
  if (!v.source) return;
  const span = Number(viewSelect.value);
  const source = v === test ? v.source
    .replace(/^([ \t]*)(o = .*)$/m, (line, indent, output) => {
      const parts = glowOutputParts(output, glowSelect.value);
      return parts ? indent + parts.join('') : line;
    })
    .replace('u * 64. / iResolution.y - 16.', span === 64
      ? 'u * 64. / iResolution.y - 16.'
      : `u * ${span}. / iResolution.y + ${48 - span / 2}.`)
    : v.source;
  const src = v === test ? golfShaderSource(source) : source;
  const err = v.renderer.load(v === test ? wrapShadertoy(src) : src);
  errorEl.style.display = err ? 'block' : 'none';
  if (err) { errorEl.textContent = v.file + ' failed to compile:\n\n' + err; return; }
  v.label.textContent = `${countLines(src)} lines`;
  if (v === test) sourceEl.textContent = src;
  draw(v);
}

function draw(v) {
  const span = Number(viewSelect.value);
  v.renderer.draw(v === orig ? {
    ...ORIG_UNIFORMS, u_viewMin: [-span / 2, -span / 2], u_viewSize: [span, span],
  } : {});
}

glowSelect.addEventListener('change', () => compile(test));
viewSelect.addEventListener('change', () => {
  draw(orig);
  compile(test);
});

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
