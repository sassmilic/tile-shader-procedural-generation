// Animated walkthrough: plays every drawing step of shader.frag, then types
// out the reflection code line by line; each reflection appears the moment
// its line is complete. Steps, titles and code are all read from shader.frag.
//
// URL options:  ?t=12.5  freeze at that time (seconds), paused.

const STEP_DUR = 1.2;     // seconds per drawing step
const STEP_FADE = 0.6;    // of which fading in
const TYPE_DUR = 1.6;     // seconds to type one reflection line
const FOLD_HOLD = 1.5;    // then the new area is shown for this long
const START_HOLD = 1.0;   // empty triangle at the start
const END_HOLD = 4.0;     // finished tiling at the end

// Fixed world windows (square, grid units). No camera motion: one cut from
// the drawing view to the wide view when the reflections start.
const DRAW_VIEW = { min: [-1, -1], size: [18, 18] };      // the base triangle, large
const WIDE_VIEW = { min: [-80, -80], size: [160, 160] };  // small triangle, ~5x5 square tiles

const canvas = document.getElementById('gl');
const stage = document.getElementById('stage');
const counterEl = document.getElementById('counter');
const titleEl = document.getElementById('title');
const codeEl = document.getElementById('code');
const scrub = document.getElementById('scrub');
const playBtn = document.getElementById('play');
const speedSel = document.getElementById('speed');
const errorEl = document.getElementById('error');

const renderer = createRenderer(canvas);
let timeline = [];        // [{ kind, start, dur, ... }]
let total = 1;
let foldLines = [];       // [{ gate: (stage) => bool, code, intro, title }] from fold()
const params = new URLSearchParams(location.search);
let time = params.has('t') ? Number(params.get('t')) : 0;
let playing = !params.has('t');

// ---------- reading shader.frag ----------

// The code line of step n: the line after "// Step n:", without the at(n) gate,
// plus one-line definitions of the named helpers it calls (s13(), ...).
function stepCode(src, n) {
  const lines = src.split('\n');
  const i = lines.findIndex((l) => new RegExp(`^\\s*//\\s*Step\\s+${n}\\s*:`).test(l));
  if (i < 0) return '';
  const code = (lines[i + 1] || '').trim().replace(/^if \(at\(\d+\)\)\s*/, '');
  const defs = [];
  for (const [, name] of code.matchAll(/\b([A-Za-z_]\w*)\(\)/g)) {
    const d = lines.find((l) => new RegExp(`^(float|void|vec2|vec3) ${name}\\(\\)`).test(l));
    if (!d) continue;
    defs.push(d.trim().endsWith('}') ? d.trim() : d.trim().replace(/\{\s*$/, '{ … }'));
  }
  return (defs.length ? defs.join('\n') + '\n\n' : '') + code;
}

// The lines of fold(): "if (<stage condition>) <code>;   // Fold k: <title>"
function parseFoldLines(src) {
  return src.split('\n')
    .map((l) => l.match(/^\s*if \(([^)]*stage[^)]*)\)\s*(.*?);\s*\/\/\s*Fold (\d+):\s*(.*)$/))
    .filter(Boolean)
    .map(([, cond, code, k, title]) => ({
      // the condition only compares `stage`, e.g. "stage == 2 || stage == 3"
      gate: new Function('stage', `return ${cond};`),
      code: code + ';',
      intro: Number(k),
      title: title.trim(),
    }));
}

// fold()'s body at stage k, as the list of lines active then.
const linesAt = (k) => foldLines.filter((l) => l.gate(k));

function buildTimeline(src) {
  foldLines = parseFoldLines(src);
  const t = [];
  let at = 0;
  const push = (seg) => { seg.start = at; at += seg.dur; t.push(seg); };
  push({ kind: 'start', dur: START_HOLD, title: 'The empty triangle A(0,0) B(16,0) C(0,16)',
         code: '// every step below is one line of shader code\n// drawn inside this triangle' });
  for (const s of parseSteps(src)) {
    if (s.n < 1) continue;
    push({ kind: 'step', n: s.n, dur: STEP_DUR, title: `Step ${s.n}: ${s.text}`, code: stepCode(src, s.n) });
  }
  const stages = [...new Set(foldLines.map((l) => l.intro))].sort((a, b) => a - b);
  for (const k of stages) {
    const line = foldLines.find((l) => l.intro === k);
    push({ kind: 'fold', k, dur: TYPE_DUR + FOLD_HOLD, title: `Reflection ${k}: ${line.title}`, line });
  }
  push({ kind: 'end', dur: END_HOLD, k: stages[stages.length - 1], title: 'The whole tiling in two lines' });
  timeline = t;
  total = at;
  scrub.max = String(total);
}

// ---------- evaluating the timeline ----------

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

function segmentAt(t) {
  for (const s of timeline) if (t < s.start + s.dur) return s;
  return timeline[timeline.length - 1];
}

function uniformsAt(t) {
  const seg = segmentAt(t);
  const local = t - seg.start;
  const lastStep = timeline.filter((s) => s.kind === 'step').pop().n;
  let u_step = 0, u_fade = 1, u_fold = 0, view = DRAW_VIEW;
  if (seg.kind === 'step') {
    u_step = seg.n;
    u_fade = smooth(0, STEP_FADE, local);
  } else if (seg.kind === 'fold' || seg.kind === 'end') {
    u_step = lastStep;
    view = WIDE_VIEW;
    // the area appears instantly once its line is fully typed
    u_fold = seg.kind === 'end' || local >= TYPE_DUR ? seg.k : seg.k - 1;
  }
  return { seg, local, u: { u_step, u_fade, u_edit: false, u_fold,
                            u_viewMin: view.min, u_viewSize: view.size, u_mouse: [-100, -100] } };
}

// ---------- display ----------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function highlight(code) {
  return code.split('\n').map((line) => {
    const i = line.indexOf('//');
    const body = i >= 0 ? line.slice(0, i) : line;
    const cm = i >= 0 ? `<span class="c">${esc(line.slice(i))}</span>` : '';
    const b = esc(body)
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="n">$1</span>')
      .replace(/\b([A-Za-z_]\w*)(?=\()/g, '<span class="f">$1</span>');
    return b + cm;
  }).join('\n');
}

// fold()'s body at stage k with the new line (typed fraction `typed`) highlighted.
function foldCodeHtml(k, typed) {
  const fn = (body) => `<span class="f">vec2</span> tile(<span class="f">vec2</span> p) {\n${body}\n    return p;\n}`;
  return fn(linesAt(k).map((l) => {
    if (l.intro !== k || typed >= 1) return '    ' + highlight(l.code);
    const shown = l.code.slice(0, Math.round(l.code.length * typed));
    return `    <span class="new">${esc(shown)}<span class="caret">▌</span></span>`;
  }).join('\n'));
}

let shownSeg = null;
function render() {
  if (!timeline.length) return;
  const { seg, local, u } = uniformsAt(time);
  renderer.draw(u);
  scrub.value = String(time);
  if (seg !== shownSeg) {
    shownSeg = seg;
    const steps = timeline.filter((s) => s.kind === 'step').length;
    const folds = timeline.filter((s) => s.kind === 'fold').length;
    counterEl.textContent =
      seg.kind === 'step' ? `step ${seg.n} of ${steps}` :
      seg.kind === 'fold' ? `reflection ${seg.k} of ${folds}` :
      seg.kind === 'start' ? 'start' : 'done';
    titleEl.textContent = seg.title;
    if (seg.kind === 'start' || seg.kind === 'step') codeEl.innerHTML = highlight(seg.code || '');
  }
  // reflection code is typed out, so it updates every frame
  if (seg.kind === 'fold') codeEl.innerHTML = foldCodeHtml(seg.k, local / TYPE_DUR);
  if (seg.kind === 'end') codeEl.innerHTML = foldCodeHtml(seg.k, 1);
}

function resize() {
  const size = Math.floor(Math.max(240, Math.min(window.innerHeight - 90,
    window.innerWidth >= 900 ? window.innerWidth - 500 : window.innerWidth - 32)));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = canvas.style.height = size + 'px';
  canvas.width = canvas.height = Math.round(size * dpr);
  stage.style.width = size + 'px';
  render();
}

// ---------- playback ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (playing) {
    time += dt * Number(speedSel.value);
    if (time >= total) time = 0;   // loop
  }
  render();
  requestAnimationFrame(frame);
}

function setPlaying(p) { playing = p; playBtn.textContent = p ? '❚❚' : '▶'; }
function jump(dir) {
  const i = timeline.indexOf(segmentAt(time));
  const j = Math.min(Math.max(i + dir, 0), timeline.length - 1);
  // land where the segment is complete: after a step's fade, after a line is typed
  const s = timeline[j];
  time = s.start + (s.kind === 'step' ? STEP_FADE : s.kind === 'fold' ? TYPE_DUR + 0.05 : s.dur * 0.5);
  setPlaying(false);
}

playBtn.onclick = () => setPlaying(!playing);
document.getElementById('prev').onclick = () => jump(-1);
document.getElementById('next').onclick = () => jump(+1);
scrub.oninput = () => { time = Number(scrub.value); setPlaying(false); };
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
  if (e.key === 'ArrowLeft') jump(-1);
  if (e.key === 'ArrowRight') jump(+1);
});

async function loadShader() {
  const src = await fetchShader();
  const err = renderer.load(src);
  errorEl.style.display = err ? 'block' : 'none';
  if (err) { errorEl.textContent = 'shader.frag failed to compile:\n\n' + err; return; }
  buildTimeline(src);
  shownSeg = null;
  time = Math.min(time, total);
  render();
}

new EventSource('/events').onmessage = (e) => {
  if (e.data === 'shader.frag') loadShader(); else location.reload();
};

window.addEventListener('resize', resize);
setPlaying(playing);
resize();
loadShader().then(() => requestAnimationFrame(frame));
