// Animated walkthrough of test.frag (the tile from circles and rectangles):
// draws its shapes one by one, then types out the reflection code line by
// line; each reflection appears the moment its line is complete.
// The shapes come from test.frag; the staged reflections from animate.frag,
// a template whose //SHAPES line is replaced by test.frag's shape table.
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

// ---------- reading test.frag and animate.frag ----------

const SHAPE_TABLE = /const vec4 S\[\d*\]\s*=\s*vec4\[\]\([\s\S]*?\);/;

// The shapes of test.frag's table: one per "vec4(...)" line, with a title
// generated from its values (plus the line's comment, if it has one).
function parseShapes(table) {
  return table.split('\n')
    .map((l) => l.match(/^\s*(vec4\(([^)]*)\)),?\s*\)?;?\s*(?:\/\/\s*(.*))?$/))
    .filter(Boolean)
    .map(([, code, args, comment]) => {
      const [x, y, z, w] = args.split(',').map(Number);
      const colour = z >= 0 ? 'white' : 'black', r = Math.abs(z);
      const at = `at (${x}, ${y})`;
      const what = w === 0 ? `${colour} circle ${at}, radius ${r}`
                 : w > 0 ? `${colour} rectangle ${at}, ${2 * r} × ${2 * w}`
                 : `${colour} square turned 45° ${at}, half diagonal ${r}`;
      const note = (comment || '').trim();
      return { code: code + ',', title: what + (note ? ` (${note})` : '') };
    })
    .map((s, i, all) => (i === all.length - 1 ? { ...s, code: s.code.slice(0, -1) } : s));
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

function buildTimeline(table, templateSrc) {
  foldLines = parseFoldLines(templateSrc);
  const t = [];
  let at = 0;
  const push = (seg) => { seg.start = at; at += seg.dur; t.push(seg); };
  push({ kind: 'start', dur: START_HOLD, title: 'The empty triangle A(0,0) B(16,0) C(0,16)' });
  parseShapes(table).forEach((s, i) => {
    push({ kind: 'step', n: i + 1, dur: STEP_DUR, title: `Shape ${i + 1}: ${s.title}`, code: s.code });
  });
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
  let u_n = 0, u_fade = 1, u_fold = 0, view = DRAW_VIEW;
  if (seg.kind === 'step') {
    u_n = seg.n;
    u_fade = smooth(0, STEP_FADE, local);
  } else if (seg.kind === 'fold' || seg.kind === 'end') {
    u_n = lastStep;
    view = WIDE_VIEW;
    // the area appears instantly once its line is fully typed
    u_fold = seg.kind === 'end' || local >= TYPE_DUR ? seg.k : seg.k - 1;
  }
  return { seg, local, u: { u_n, u_fade, u_fold, u_viewMin: view.min, u_viewSize: view.size } };
}

// ---------- display: the whole program written so far ----------

const PINK = [0xff, 0x14, 0x93];   // a freshly written line
const GRAY = [0xa6, 0xa6, 0xa6];   // older code
const FLASH = 1.2;                 // seconds for a new line to settle from pink to gray

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A code line coloured by its age (seconds since it was written).
function aged(text, age) {
  if (age >= FLASH) return esc(text);
  const k = smooth(0, FLASH, age);
  const c = PINK.map((v, i) => Math.round(v + (GRAY[i] - v) * k));
  return `<span style="color: rgb(${c})">${esc(text)}</span>`;
}

// One code line; indented lines wrap with a hanging indent.
const ln = (html, indent = 0) => `<div class="ln${indent ? ' in' : ''}">${html || '&nbsp;'}</div>`;

function programHtml(t) {
  const out = [ln('const vec4 S[] = vec4[](')];
  for (const s of timeline) {
    if (s.kind === 'step' && s.start <= t) out.push(ln(aged(s.code, t - s.start), 1));
  }
  out.push(ln(');'));

  const folds = timeline.filter((s) => s.kind === 'fold');
  if (folds.length && t >= folds[0].start) {
    const cur = segmentAt(t);
    const k = cur.kind === 'fold' || cur.kind === 'end' ? cur.k : folds[folds.length - 1].k;
    const typing = cur.kind === 'fold' ? (t - cur.start) / TYPE_DUR : 1;
    out.push(ln(''), ln('vec2 tile(vec2 p) {'));
    for (const l of linesAt(k)) {
      const seg = folds.find((f) => f.k === l.intro);
      if (l.intro === k && typing < 1) {
        // being typed: pink, with a caret
        const shown = l.code.slice(0, Math.round(l.code.length * typing));
        out.push(ln(`<span style="color: rgb(${PINK})">${esc(shown)}<span class="caret">▌</span></span>`, 1));
      } else {
        out.push(ln(aged(l.code, t - (seg.start + TYPE_DUR)), 1));
      }
    }
    out.push(ln('return p;', 1), ln('}'));
  }
  return out.join('');
}

let shownSeg = null, shownLines = 0;
function render() {
  if (!timeline.length) return;
  const { seg, u } = uniformsAt(time);
  renderer.draw(u);
  scrub.value = String(time);
  if (seg !== shownSeg) {
    shownSeg = seg;
    const steps = timeline.filter((s) => s.kind === 'step').length;
    const folds = timeline.filter((s) => s.kind === 'fold').length;
    counterEl.textContent =
      seg.kind === 'step' ? `shape ${seg.n} of ${steps}` :
      seg.kind === 'fold' ? `reflection ${seg.k} of ${folds}` :
      seg.kind === 'start' ? 'start' : 'done';
    titleEl.textContent = seg.title;
  }
  // colours change continuously while lines flash, so redraw the code every frame
  const html = programHtml(time);
  codeEl.innerHTML = html;
  const n = html.split('class="ln').length;
  if (n !== shownLines) {
    // keep the newest line in view
    shownLines = n;
    const fresh = codeEl.querySelector('span[style]');
    if (fresh) fresh.scrollIntoView({ block: 'nearest' });
  }
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
  const [testSrc, templateSrc] = await Promise.all([fetchShader('test.frag'), fetchShader('animate.frag')]);
  const table = (testSrc.match(SHAPE_TABLE) || [])[0];
  if (!table) { errorEl.textContent = 'no shape table (const vec4 S[] = vec4[](...);) in test.frag'; errorEl.style.display = 'block'; return; }
  const err = renderer.load(templateSrc.replace('//SHAPES', table));
  errorEl.style.display = err ? 'block' : 'none';
  if (err) { errorEl.textContent = 'animation shader failed to compile:\n\n' + err; return; }
  buildTimeline(table, templateSrc);
  shownSeg = null;
  time = Math.min(time, total);
  render();
}

new EventSource('/events').onmessage = (e) => {
  if (e.data === 'test.frag' || e.data === 'animate.frag') loadShader();
  else if (e.data !== 'shader.frag' && e.data !== 'test.js' && e.data !== 'test.html') location.reload();
};

window.addEventListener('resize', resize);
setPlaying(playing);
resize();
loadShader().then(() => requestAnimationFrame(frame));
