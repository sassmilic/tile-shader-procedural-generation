// Animated walkthrough: plays every drawing step of shader.frag, then the
// reflections, showing each step's (one-line) code. Everything — the steps,
// their titles and their code — is read from shader.frag itself.
//
// URL options:  ?t=12.5  freeze at that time (seconds), paused.

const STEP_DUR = 1.2;     // seconds per drawing step
const STEP_FADE = 0.6;    // of which fading in
const FOLD_DUR = 2.8;     // seconds per reflection
const START_HOLD = 1.0;   // empty triangle at the start
const END_HOLD = 3.0;     // finished tiling at the end

// World window (square, grid units) shown after each fold stage: [centre, size]
const VIEWS = [
  [[7.5, 8], 18],   // 0: the base triangle
  [[0, 8], 34],     // 1: + mirror across the left edge  -> big triangle
  [[0, 0], 34],     // 2: + mirror across the bottom edge -> diamond
  [[0, 0], 64],     // 3: mirrored across every side      -> tiling
];

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
const params = new URLSearchParams(location.search);
let time = params.has('t') ? Number(params.get('t')) : 0;
let playing = !params.has('t');

// ---------- reading shader.frag ----------

// The code line(s) of step n: the line after "// Step n:", without the at(n) gate,
// plus one-line definitions of the named helpers it calls (s13(), ...).
function stepCode(src, n) {
  const lines = src.split('\n');
  const i = lines.findIndex((l) => new RegExp(`^\\s*//\\s*Step\\s+${n}\\s*:`).test(l));
  if (i < 0) return '';
  let code = (lines[i + 1] || '').trim().replace(/^if \(at\(\d+\)\)\s*/, '');
  const defs = [];
  for (const [, name] of code.matchAll(/\b([A-Za-z_]\w*)\(\)/g)) {
    const d = lines.find((l) => new RegExp(`^(float|void|vec2|vec3) ${name}\\(\\)`).test(l));
    if (!d) continue;
    defs.push(d.trim().endsWith('}') ? d.trim() : d.trim().replace(/\{\s*$/, '{ … }'));
  }
  return (defs.length ? defs.join('\n') + '\n\n' : '') + code;
}

// Reflection k: the lines tagged "// Fold k:".
function foldParts(src, k) {
  const lines = src.split('\n').filter((l) => new RegExp(`//\\s*Fold ${k}:`).test(l));
  const titles = lines.map((l) => l.split(/\/\/\s*Fold \d+:\s*/)[1].trim());
  // show just the operation: drop the "stage >= k" gate and the "Fold k:" tag
  const code = lines.map((l) => l.trim()
      .replace(/^if \(stage >= \d+\)\s*/, '')
      .replace(/^if \(stage >= \d+ && (.*?)\)\s*(?=p)/, 'if ($1) ')
      .replace(/\s*\/\/\s*Fold \d+:\s*/, '   // '))
    .join('\n');
  return { title: titles.join(', then '), code };
}

function buildTimeline(src) {
  const t = [];
  let at = 0;
  const push = (seg) => { seg.start = at; at += seg.dur; t.push(seg); };
  push({ kind: 'start', dur: START_HOLD, title: 'The empty triangle A(0,0) B(16,0) C(0,16)',
         code: '// every step below is one line of shader code\n// drawn inside this triangle' });
  for (const s of parseSteps(src)) {
    if (s.n < 1) continue;
    push({ kind: 'step', n: s.n, dur: STEP_DUR, title: `Step ${s.n}: ${s.text}`, code: stepCode(src, s.n) });
  }
  for (let k = 1; k <= 3; k++) {
    const f = foldParts(src, k);
    push({ kind: 'fold', k, dur: FOLD_DUR, title: `Reflection ${k}: ${f.title}`, code: f.code });
  }
  push({ kind: 'end', dur: END_HOLD, title: 'The finished tile', code: '' });
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

function viewFor(fromStage, toStage, x) {
  const [c0, s0] = VIEWS[fromStage], [c1, s1] = VIEWS[toStage];
  const size = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * x);   // zoom evenly
  const cx = c0[0] + (c1[0] - c0[0]) * x, cy = c0[1] + (c1[1] - c0[1]) * x;
  return { min: [cx - size / 2, cy - size / 2], size: [size, size] };
}

function uniformsAt(t) {
  const seg = segmentAt(t);
  const local = t - seg.start;
  const lastStep = timeline.filter((s) => s.kind === 'step').pop().n;
  let u_step = 0, u_fade = 1, u_fold = 0, u_foldFade = 1, view = viewFor(0, 0, 0);
  if (seg.kind === 'step') {
    u_step = seg.n;
    u_fade = smooth(0, STEP_FADE, local);
  } else if (seg.kind === 'fold') {
    u_step = lastStep;
    u_fold = seg.k;
    view = viewFor(seg.k - 1, seg.k, smooth(0, 0.55 * FOLD_DUR, local));
    u_foldFade = smooth(0.35 * FOLD_DUR, 0.85 * FOLD_DUR, local);
  } else if (seg.kind === 'end') {
    u_step = lastStep;
    u_fold = 3;
    view = viewFor(3, 3, 0);
  }
  return { seg, u: { u_step, u_fade, u_edit: false, u_fold, u_foldFade,
                     u_viewMin: view.min, u_viewSize: view.size, u_mouse: [-100, -100] } };
}

// ---------- display ----------

function highlight(code) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

let shownSeg = null;
function render() {
  if (!timeline.length) return;
  const { seg, u } = uniformsAt(time);
  renderer.draw(u);
  scrub.value = String(time);
  if (seg !== shownSeg) {
    shownSeg = seg;
    const steps = timeline.filter((s) => s.kind === 'step').length;
    counterEl.textContent =
      seg.kind === 'step' ? `step ${seg.n} of ${steps}` :
      seg.kind === 'fold' ? `reflection ${seg.k} of 3` :
      seg.kind === 'start' ? 'start' : 'done';
    titleEl.textContent = seg.title;
    codeEl.innerHTML = highlight(seg.code || '');
    codeEl.style.display = seg.code ? 'block' : 'none';
  }
}

function resize() {
  const size = Math.floor(Math.max(240, Math.min(window.innerHeight - 90,
    window.innerWidth >= 900 ? window.innerWidth - 470 : window.innerWidth - 32)));
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
  // land at the end of a step's fade so the step is fully visible
  time = timeline[j].start + (timeline[j].kind === 'step' ? STEP_FADE : timeline[j].dur * 0.9);
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
