// The build animation: test.frag's program written out piece by piece.
//
// At every moment the code panel shows a complete, valid shader, and that
// exact text is what the GPU runs (its numbers are passed in as uniforms so
// they can glide). A shape function or colour function is written the first
// time it is needed; after that every shape costs one call line. Then the
// smoothing, then the reflections are typed into tile(), then it runs
// forever: random numbers turn pink and glide to new values.
//
// URL options:  ?t=12.5  freeze at that time (seconds), paused; past the
//                        build this fast-forwards through the mutations
//               ?seed=7  repeatable random mutations

const STEP_DUR = 1.2;     // seconds per shape
const BLEND_DUR = 3.0;    // the smoothing step
const BLEND_GROW = 2.0;   // of which BLEND counts up from 0
const TYPE_DUR = 1.6;     // seconds to type one reflection line
const FOLD_HOLD = 1.5;    // then the result is shown for this long
const START_HOLD = 1.0;   // the empty triangle
const END_HOLD = 4.0;     // finished tiling, then the endless mutations start
const MUTATE_EVERY = 2.2; // seconds between mutations
const MUTATE_DUR = 1.4;   // seconds a number takes to glide to its new value
const HOME = 0.35;        // chance a mutation sends a number back to its original value
const FLASH = 1.2;        // seconds for new code to settle from pink to gray

// world windows: [size, offset] as written in main(): px = size / res; p = xy * px - offset
const DRAW_VIEW = [18, 1];     // the triangle, large
const WIDE_VIEW = [160, 80];   // small triangle, ~5x5 square tiles

const canvas = document.getElementById('gl');
const stage = document.getElementById('stage');
const codeEl = document.getElementById('code');
const sizeEl = document.getElementById('size');
const errorEl = document.getElementById('error');
const renderer = createRenderer(canvas);
const params = new URLSearchParams(location.search);
let time = params.has('t') ? Number(params.get('t')) : 0;
let playing = !params.has('t');

// ---------- reading test.frag ----------

const NUM = /(?<![\w.])(\d+\.\d*|\.\d+|\d+)(?![\w.])/g;   // a number literal
let P = null;   // the parsed program

function parseProgram(src) {
  const lines = src.split('\n').map((l) => l.replace(/\s*\/\/.*$/, ''));   // no comments
  const body = (open) => {                       // trimmed lines of a { ... } block
    const i = lines.findIndex((l) => l.startsWith(open));
    const j = lines.findIndex((l, k) => k > i && l === '}');
    return lines.slice(i + 1, j).map((l) => l.trim()).filter(Boolean);
  };
  const def = (re) => (lines.find((l) => re.test(l)) || '').trim();
  const p = {
    header: lines.filter((l) => /^(#version|precision|uniform|out )/.test(l)),
    tile: body('vec2 tile('),
    defs: [                                      // in the order they appear in the program
      ['D', def(/^float D\b/)],
      ['smin', def(/^float smin\(/)],
      ['white', def(/^void white\(float d\)/)],
      ['black', def(/^void black\(float d\)/)],
      ['white2', def(/^void white\(float d, float k\)/)],
      ['black2', def(/^void black\(float d, float k\)/)],
      ['circle', def(/^float circle\(/)],
      ['rect', def(/^float rect\(/)],
      ['diamond', def(/^float diamond\(/)],
      ['blend', def(/^const float BLEND/)],
    ],
    main: body('void main()'),
  };
  p.blend = Number((p.defs.find((d) => d[0] === 'blend')[1].match(NUM) || [0])[0]);
  p.calls = p.main
    .map((l) => l.match(/^(white|black)\((circle|rect|diamond)\(p, ([^)]*)\)(, BLEND)?\);$/))
    .filter(Boolean)
    .map(([, colour, shape, args, smooth]) => ({ colour, shape, args: args.split(',').map(Number), smooth: !!smooth }));
  const find = (re) => p.main.find((l) => re.test(l));
  p.pxLine = find(/^float px/);
  p.pLine = find(/^vec2 p =/);
  p.tileCall = find(/^p = tile\(p\)/);
  p.discard = find(/discard/);
  p.output = find(/^o = /);
  return p;
}

// tile() as it is built up: stage k adds or changes one line; stage 4 is test.frag's.
function tileStages() {
  const [l1, l2] = P.tile;
  return [[], ['p.x = abs(p.x);'], ['p = abs(p);'], ['p = abs(p);', l2], [l1, l2]];
}

// ---------- the timeline ----------

let timeline = [], total = 1;
function buildTimeline() {
  const t = [];
  let at = 0;
  const push = (seg) => { seg.start = at; at += seg.dur; t.push(seg); };
  push({ kind: 'start', dur: START_HOLD });
  P.calls.forEach((c, i) => push({ kind: 'step', n: i + 1, dur: STEP_DUR }));
  push({ kind: 'blend', dur: BLEND_DUR });
  for (let k = 1; k <= 4; k++) push({ kind: 'fold', k, dur: TYPE_DUR + FOLD_HOLD });
  push({ kind: 'end', dur: END_HOLD });
  timeline = t;
  total = at;
}
const segOf = (kind, k) => timeline.find((s) => s.kind === kind && (k === undefined || s.k === k || s.n === k));

// ---------- numbers: original, live values, and what is changing ----------

let original = new Map(), values = new Map();
let tweens = [], nextMutation = 0, liveClock = 0;

let seed = Number(params.get('seed')) || (Math.random() * 2 ** 32) >>> 0;
function rand() {                                // mulberry32
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
}
const between = (a, b) => a + (b - a) * rand();
const round2 = (v) => Math.round(v * 100) / 100;
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

function resetValues() {
  original = new Map();
  P.calls.forEach((c, i) => c.args.forEach((v, j) => original.set(`c${i}:${j}`, v)));
  original.set('blend', P.blend);
  values = new Map(original);
  tweens = [];
  nextMutation = 0;
  liveClock = 0;
}

// Mutable: shape positions (args 0, 1) and sizes (the rest), and BLEND.
const mutableKeys = () => [...original.keys()];
function targetFor(key) {
  const o = original.get(key);
  if (rand() < HOME) return o;
  if (key === 'blend') return between(0, 1);
  const j = Number(key.split(':')[1]);
  return j < 2 ? o + between(-2.5, 2.5) : Math.max(0.1, o * between(0.5, 1.6));
}
function applyTweens(c) {
  for (const tw of tweens) {
    if (tw.start <= c) values.set(tw.key, tw.from + (tw.to - tw.from) * smooth(tw.start, tw.start + tw.dur, c));
  }
}
function updateLive(clock) {                     // works for big jumps too (?t=...)
  while (clock >= nextMutation) {
    applyTweens(nextMutation);
    const busy = new Set(tweens.filter((tw) => tw.start + tw.dur > nextMutation).map((tw) => tw.key));
    const keys = mutableKeys().filter((k) => !busy.has(k));
    const key = keys[Math.floor(rand() * keys.length)];
    tweens.push({ key, from: values.get(key), to: round2(targetFor(key)), start: nextMutation, dur: MUTATE_DUR });
    nextMutation += MUTATE_EVERY;
    tweens = tweens.filter((tw) => nextMutation < tw.start + tw.dur + FLASH + MUTATE_EVERY);
  }
  applyTweens(clock);
  liveClock = clock;
}

// ---------- the program at time t ----------
//
// A line is { parts, intro, typed }: parts are strings and numbers {key, value};
// intro is when the line was written (it flashes pink); typed (0..1) is set
// while a line is being typed.

const num = (key, value) => ({ key, value });
function numbered(text, prefix, fixed = {}) {    // split a line's number literals into parts
  const parts = [];
  let last = 0, n = 0;
  for (const m of text.matchAll(NUM)) {
    parts.push(text.slice(last, m.index));
    parts.push(num(`${prefix}:${n}`, n in fixed ? fixed[n] : Number(m[0])));
    last = m.index + m[0].length;
    n++;
  }
  parts.push(text.slice(last));
  return parts;
}

// forGpu: the program the GPU runs, i.e. tile() as of the last finished stage
// (a half-typed line doesn't count yet, and the line it replaces still does).
function programAt(t, forGpu = false) {
  const live = t >= total;
  const blendSeg = segOf('blend');
  const smoothOn = t >= blendSeg.start;
  const fold1 = segOf('fold', 1);
  const wide = t >= fold1.start;
  const [size, offset] = wide ? WIDE_VIEW : DRAW_VIEW;

  // which shapes are written, and when each def was first needed
  const steps = timeline.filter((s) => s.kind === 'step' && s.start <= t);
  const firstUse = {};
  steps.forEach((s) => {
    const c = P.calls[s.n - 1];
    firstUse[c.colour] ??= s.start;
    firstUse[c.shape] ??= s.start;
    if (c.smooth && smoothOn) firstUse[c.colour + '2'] ??= blendSeg.start;
  });
  if (smoothOn) { firstUse.smin = blendSeg.start; firstUse.blend = blendSeg.start; }

  // tile(): stage reached, and the line being typed
  const foldSeg = timeline.find((s) => s.kind === 'fold' && s.start <= t && t < s.start + s.dur);
  let k = 0;
  for (let i = 1; i <= 4; i++) if (t >= segOf('fold', i).start + TYPE_DUR) k = i;
  const typing = !forGpu && foldSeg && t < foldSeg.start + TYPE_DUR ? foldSeg.k : 0;
  const shown = typing || k;                     // the stage displayed (or run)

  const L = [];
  const line = (parts, intro = null, indent = 0, typed = null) =>
    L.push({ parts: typeof parts === 'string' ? [parts] : parts, intro, indent, typed });
  P.header.forEach((h) => line(h));
  if (shown) {
    const stages = tileStages();
    const prev = stages[shown - 1], cur = stages[shown];
    line('', fold1.start);
    line('vec2 tile(vec2 p) {', fold1.start);
    cur.forEach((l) => {
      const fresh = !prev.includes(l);
      const since = segOf('fold', shown).start;
      if (fresh && typing) line(l, since, 1, (t - since) / TYPE_DUR);
      else line(l, fresh ? since + TYPE_DUR : null, 1);
    });
    line('return p;', fold1.start, 1);
    line('}', fold1.start);
  }
  line('');
  for (const [name, text] of P.defs) {
    if (name === 'D') line(text);
    else if (name === 'blend' && smoothOn) {
      line(['const float BLEND = ', num('blend', values.get('blend')), ';'], blendSeg.start);
    } else if (firstUse[name] !== undefined) line(text, firstUse[name]);
  }
  line('');
  line('void main() {');
  line(numbered(P.pxLine, 'px', { 0: size }), wide ? fold1.start : null, 1);
  line(numbered(P.pLine, 'off', { 0: offset }), wide ? fold1.start : null, 1);
  if (shown) line(P.tileCall, fold1.start, 1);
  line(numbered(P.discard, 'disc'), null, 1);
  steps.forEach((s) => {
    const i = s.n - 1, c = P.calls[i];
    const args = c.args.map((v, j) => num(`c${i}:${j}`, values.get(`c${i}:${j}`)));
    const parts = [`${c.colour}(${c.shape}(p, `];
    args.forEach((a, j) => { if (j) parts.push(', '); parts.push(a); });
    parts.push(c.smooth && smoothOn ? '), BLEND);' : '));');
    line(parts, c.smooth && smoothOn && !live && t < blendSeg.start + FLASH ? blendSeg.start : s.start, 1);
  });
  line(numbered(P.output, 'out'), null, 1);
  line('}');
  return { lines: L };
}

// The program as GLSL: numbers either written out (display) or as uniforms (GPU).
const fmt = (v) => { const s = String(round2(v)); return s.includes('.') ? s : s + '.'; };
function gpuSource(prog) {
  const keys = [];
  const text = prog.lines
    .map((l) => l.parts.map((p) => (typeof p === 'string' ? p : `V[${keys.push(p) - 1}]`)).join(''))
    // a uniform isn't a constant, so BLEND becomes a macro for its uniform
    .map((s) => s.replace(/^const float BLEND = (V\[\d+\]);$/, '#define BLEND $1'))
    .join('\n')
    .replace(/out vec4 o;/, `out vec4 o;\nuniform float V[${Math.max(keys.length, 1)}];`);
  return { text, keys };
}

// ---------- display ----------

const PINK = [0xff, 0x14, 0x93];
const GRAY = [0xa6, 0xa6, 0xa6];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function colour(age) {                           // pink fading to gray, or null when old
  if (age === null || age >= FLASH) return null;
  const k = smooth(0, FLASH, age);
  return `rgb(${PINK.map((v, i) => Math.round(v + (GRAY[i] - v) * k))})`;
}
const paint = (html, c) => (c ? `<span style="color:${c}">${html}</span>` : html);

// how long ago a number finished changing (0 while changing), or null
function numberAge(key, t) {
  if (t >= total) {
    const tw = [...tweens].reverse().find((x) => x.key === key && x.start <= liveClock);
    return tw ? Math.max(0, liveClock - (tw.start + tw.dur)) : null;
  }
  if (key === 'blend') {
    const b = segOf('blend');
    return t >= b.start ? Math.max(0, t - (b.start + BLEND_GROW)) : null;
  }
  return null;
}

function lineHtml(l, t) {
  const age = l.intro === null ? null : t - l.intro;
  if (l.typed !== null && l.typed < 1) {        // being typed
    const text = l.parts.join('').slice(0, Math.round(l.parts.join('').length * l.typed));
    return paint(esc(text) + '<span class="caret">▌</span>', `rgb(${PINK})`);
  }
  const whole = colour(age);
  const html = l.parts.map((p) => {
    if (typeof p === 'string') return esc(p);
    const text = fmt(p.value);
    return whole ? esc(text) : paint(esc(text), colour(numberAge(p.key, t)));
  }).join('');
  return paint(html, whole);
}

const lineText = (l) => {
  const s = l.parts.map((p) => (typeof p === 'string' ? p : fmt(p.value))).join('');
  return l.typed !== null && l.typed < 1 ? s.slice(0, Math.round(s.length * l.typed)) : s;
};

// ---------- render ----------

let compiledText = null, gpuKeys = [], shownLines = 0;
function render() {
  if (!P) return;
  if (time >= total) updateLive(time - total);
  else if (time >= segOf('blend').start) {
    // the smoothing: BLEND counts up from 0
    const b = segOf('blend');
    values.set('blend', P.blend * smooth(b.start, b.start + BLEND_GROW, time));
  }
  const prog = programAt(time);

  // compile when the program's structure changes; numbers go in as uniforms
  const gpu = gpuSource(programAt(time, true));
  if (gpu.text !== compiledText) {
    const err = renderer.load(gpu.text);
    errorEl.style.display = err ? 'block' : 'none';
    if (err) errorEl.textContent = 'program failed to compile:\n\n' + err + '\n\n' + gpu.text;
    compiledText = gpu.text;
  }
  gpuKeys = gpu.keys;
  renderer.draw({ V: gpuKeys.map((p) => p.value) });

  // the code panel and its size
  codeEl.innerHTML = prog.lines.map((l) =>
    `<div class="ln${l.indent ? ' in' : ''}">${lineHtml(l, time) || '&nbsp;'}</div>`).join('');
  const text = prog.lines.map((l) => (l.indent ? '    ' : '') + lineText(l)).join('\n');
  sizeEl.textContent = `${new TextEncoder().encode(text).length} bytes · ${prog.lines.length} lines`;
  // keep whatever just turned pink in view: a new line, or a mutating number
  const marker = prog.lines.length * 1e6 + nextMutation;
  if (marker !== shownLines) {
    shownLines = marker;
    const fresh = codeEl.querySelector('span[style]');
    if (fresh) fresh.scrollIntoView({ block: 'nearest' });
  }
}

function resize() {
  // leave room for the 560px code panel + gaps on the right, buttons below
  const size = Math.floor(Math.max(240, Math.min(window.innerHeight - 70,
    window.innerWidth >= 900 ? window.innerWidth - 640 : window.innerWidth - 32)));
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
  if (playing) time += dt;                       // no loop: past the build it mutates forever
  render();
  requestAnimationFrame(frame);
}

document.getElementById('play').onclick = () => { playing = true; };
document.getElementById('stop').onclick = () => { playing = false; };
document.getElementById('rewind').onclick = () => { time = 0; shownLines = 0; if (P) resetValues(); };
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); playing = !playing; }
});

async function load() {
  P = parseProgram(await fetchShader('test.frag'));
  buildTimeline();
  resetValues();
  compiledText = null;
  render();
}

new EventSource('/events').onmessage = (e) => {
  if (e.data === 'test.frag') load();
  else if (['animate.js', 'animate.html', 'renderer.js'].includes(e.data)) location.reload();
};

window.addEventListener('resize', resize);
resize();
load().then(() => requestAnimationFrame(frame));
