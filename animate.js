// The build animation: test.frag's program written out piece by piece.
//
// The program is a sequence of versions (empty sheet, + each shape, drawn
// whole, + the cut to the triangle, + each reflection stage, + the glow and
// the glow). Going from one version to the next,
// every new or changed line is typed out, and the picture changes only when
// the typing is done: until then the GPU runs the previous version. Number
// changes are not typed; they glide (the view size, the glow coming in, and
// the endless mutations at the end). The glow is a named parameter
// smoothly into one another. (Colour is out for now; see git history.)
//
// At every moment the panel shows a complete, valid shader, and that exact
// text is what the GPU runs (its numbers are passed in as uniforms).
//
// URL options:  ?t=12.5  freeze at that time (seconds), paused; past the
//                        build this fast-forwards through the mutations
//               ?seed=7  repeatable random mutations

const CPS = 55;           // typing speed, characters per second
const LEAD = 0.15;        // pause before a step starts typing
const STEP_HOLD = 0.6;    // after a shape is typed
const FOLD_HOLD = 1.5;    // after a reflection is typed
const GLOW_GROW = 2.0;    // the glow comes in (its number glides) once its line is typed
const GLOW_FROM = 30;     // glow number when first typed: sharp edges (lower = more glow)
const START_HOLD = 1.0;   // the empty sheet
const CUT_HOLD = 1.2;     // after the cut to the triangle
const END_HOLD = 4.0;     // finished tiling, then the endless mutations start
const MUTATE_EVERY = 2.2; // seconds between mutations
const MUTATE_DUR = 1.4;   // seconds numbers take to glide to their new values
const HOME = 0.35;        // chance a mutation sends a number back to its original value
const MOVE = 6;           // how far a shape's x or y can move from where it started (grid units)
const VIEW_CHANCE = 0.14; // chance a mutation also zooms (changes the number of tiles on screen)
const TILES = [4, 8];     // the mosaic is between 4x4 and 8x8 tiles when zooming
const TILE = 32;          // world units per square tile (the triangle, reflected: mod 32)
const TRI_MOVE = 1.5;     // how far a triangle's corner can move sideways (grid units)
const FLASH = 1.2;        // seconds for new code to settle from pink to gray
const TOGGLE_AFTER = 1.0; // the Questions button appears this long after the code is fully written

// world windows: [size, offset] as written in main(): px = size / res; p = xy * px - offset
let ALL_VIEW = [42, 14];       // every shape whole (worked out from the shapes in load())
const WIDE_VIEW = [160, 80];   // ~5x5 square tiles: where zooming goes "home" to

const canvas = document.getElementById('gl');
const stage = document.getElementById('stage');
const codeEl = document.getElementById('code');
const sizeEl = document.getElementById('size');
const errorEl = document.getElementById('error');
const toggleEl = document.getElementById('toggle');
const panelEl = document.getElementById('panel');
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
    tile: def(/^vec2 tile\(/),
    main: body('void mainImage('),
    mainOpen: def(/^void mainImage\(/),
    D: def(/^vec2 p; float D\b/),                    // vec2 p; float D = 1e9, glow = ..;
    add: def(/^void add\(/),
    cut: def(/^void cut\(/),
    shapes: { circle: def(/^float circle\(/), rect: def(/^float rect\(/), tri: def(/^float tri\(/) },
  };
  p.calls = p.main
    // add(circle(x, y, r)); or, for a ring, add(abs(circle(x, y, r)) - w); (w is the last arg)
    .map((l) => l.match(/^(add|cut)\((abs\()?(circle|rect|tri)\(([^)]*)\)(?:\) - ([\d.]+))?\);$/))
    .filter(Boolean)
    .map(([, colour, ring, shape, args, w]) => ({ colour, shape, ring: !!ring,
      args: [...args.split(',').map(Number), ...(ring ? [Number(w)] : [])] }));
  const find = (re) => p.main.find((l) => re.test(l));
  p.pLine = find(/^p = tile\(/);                 // the view (size, offset), after the reflections arrive
  p.pLine0 = p.pLine.replace(/tile\((.*)\);$/, '$1;');   // before
  // the cut: once tile() is complete it folds every point into the triangle,
  // so test.frag doesn't need it; it's only typed while building
  p.discard = 'if (p.x < 0. || p.y < 0. || p.x + p.y > 16.) discard;';
  p.output = find(/^o = /);                      // with the glow, as in test.frag
  p.output0 = 'o = vec4(vec3(.5 - D / fwidth(D)), 1);';   // sharp, anti-aliased edges: before the glow
  p.glow = Number(p.D.match(/glow = ([\d.]+)/)[1]);
  return p;
}

// tile() as it is built up, one line per reflection stage; stage 4 is test.frag's.
function tileStages() {
  const head = 'vec2 tile(vec2 p) { ';
  return ['', head + 'return vec2(abs(p.x), p.y); }', head + 'return abs(p); }',
          P.tile.replace(/abs\(mod\([^)]*\) - [\d.]+\)/, 'abs(p)'), P.tile];
}

// ---------- program versions ----------
//
// A line is { id, parts, indent }: parts are strings and numbers {key};
// its "shape" (text with numbers blanked) tells a real code change from a
// mere number change.

const num = (key) => ({ key });
function numbered(text, prefix) {                // a line with its number literals as parts
  const parts = [];
  let last = 0, n = 0;
  for (const m of text.matchAll(NUM)) {
    parts.push(text.slice(last, m.index), num(`${prefix}:${n++}`));
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}
const shapeOf = (l) => l.parts.map((p) => (typeof p === 'string' ? p : '#')).join('');

// `vec2 p; float D = 1e9, glow = 3.1;`, with the glow once it's typed (its number is the key 'glow')
const declLine = (glow) => [P.D.split(',')[0], ...(glow ? [', glow = ', num('glow')] : []), ';'];

// The program after `n` shapes, cut to the triangle or not, at reflection
// stage `k`, with or without the glow.
function version({ n, cut, k, glow }) {
  const L = [];
  const line = (id, parts, indent = 0) => L.push({ id, parts: typeof parts === 'string' ? [parts] : parts, indent });
  if (k) {
    line('tile', tileStages()[k]);
    line('tile:gap', '');
  }
  const calls = P.calls.slice(0, n);
  const used = new Set(calls.flatMap((c) => [c.colour, c.shape]));
  line('g:D', declLine(glow));
  if (used.has('add')) line('def:add', P.add);
  if (used.has('cut')) line('def:cut', P.cut);
  for (const s of ['circle', 'rect', 'tri']) if (used.has(s)) line(`def:${s}`, P.shapes[s]);
  line('main:gap', '');
  line('main:open', P.mainOpen);
  line('main:p', numbered(k ? P.pLine : P.pLine0, 'view'), 1);
  if (cut && k < 4) line('main:discard', numbered(P.discard, 'disc'), 1);   // not needed once tile() is complete
  calls.forEach((c, i) => {
    const parts = [`${c.colour}(${c.ring ? 'abs(' : ''}${c.shape}(`];
    c.args.forEach((_, j) => {
      if (c.ring && j === c.args.length - 1) parts.push(')) - ');   // a ring's width
      else if (j) parts.push(', ');
      parts.push(num(`c${i}:${j}`));
    });
    parts.push(c.ring ? ');' : '));');
    line(`call:${i}`, parts, 1);
  });
  line('main:out', glow ? numbered(P.output, 'out') : numbered(P.output0, 'out0'), 1);
  line('main:close', '}');
  return L;
}

// ---------- the timeline ----------
//
// Each segment goes from version `from` to version `to`; its `edits` are the
// new or changed lines, typed one after another starting at `start + LEAD`.

let timeline = [], total = 1;
function buildTimeline() {
  const N = P.calls.length;
  const states = [{ n: 0, k: 0 }];
  const kinds = [['start', START_HOLD]];
  for (let n = 1; n <= N; n++) { states.push({ n, k: 0 }); kinds.push(['step', STEP_HOLD]); }
  states.push({ n: N, cut: true, k: 0 }); kinds.push(['cut', CUT_HOLD]);
  for (let k = 1; k <= 4; k++) { states.push({ n: N, cut: true, k }); kinds.push(['fold', FOLD_HOLD]); }
  const done = { n: N, cut: true, k: 4 };
  states.push({ ...done, glow: true }); kinds.push(['glow', GLOW_GROW + 0.6]);
  states.push(states[states.length - 1]); kinds.push(['end', END_HOLD]);

  const t = [];
  let at = 0;
  states.forEach((state, i) => {
    const to = version(state);
    const from = i ? t[i - 1].to : to;
    const old = new Map(from.map((l) => [l.id, l]));
    let clock = LEAD;
    const edits = [];
    for (const l of i ? to : []) {
      const before = old.get(l.id);
      if (before && shapeOf(before) === shapeOf(l)) continue;   // unchanged (numbers may differ)
      const dur = Math.max(0.05, lineText(l, true).length / CPS);
      edits.push({ id: l.id, start: clock, dur });
      clock += dur;
    }
    const typed = i ? clock : 0;
    const [kind, hold] = kinds[i];
    const seg = { kind, state, from, to, edits, start: at, typed, dur: typed + hold };
    at += seg.dur;
    t.push(seg);
  });
  timeline = t;
  total = at;
}
const segAt = (t) => timeline.find((s) => t < s.start + s.dur) || timeline[timeline.length - 1];
const firstOf = (kind) => timeline.find((s) => s.kind === kind);

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

// the fixed numbers of the program lines (view, discard, output)
function fixedNumbers() {
  const m = new Map();
  const lines = [[P.pLine, 'view'], [P.discard, 'disc'],
                 [P.output, 'out'], [P.output0, 'out0']];
  for (const [text, prefix] of lines) {
    [...text.matchAll(NUM)].forEach((x, n) => m.set(`${prefix}:${n}`, Number(x[0])));
  }
  return m;
}
let fixed = new Map();

function resetValues() {
  original = new Map();
  P.calls.forEach((c, i) => c.args.forEach((v, j) => original.set(`c${i}:${j}`, v)));
  original.set('glow', P.glow);
  values = new Map(original);
  // the view (how many tiles fit on screen) as the build leaves it; zooming takes over from there
  values.set('view:0', ALL_VIEW[0]);
  values.set('view:1', ALL_VIEW[1]);
  fixed = fixedNumbers();
  tweens = [];
  nextMutation = 0;
  liveClock = 0;
}

// Mutable one number at a time: shape positions (args 0, 1), sizes (the rest),
// and the glow. A triangle tri(a, b, h) is (a,0) (b,0) (b,h): a and b move
// less, so it can't turn inside out. (The zoom has its own chance, below.)
const mutableKeys = () => [...original.keys()];
function targetFor(key) {
  const o = original.get(key);
  if (rand() < HOME) return o;
  if (key === 'glow') return between(1.25, 5);  // lower = wider glow
  const [i, j] = key.slice(1).split(':').map(Number);
  if (P.calls[i].shape === 'tri' && j < 2) return o + between(-TRI_MOVE, TRI_MOVE);   // a corner's x
  if (j < 2) return o + between(-MOVE, MOVE);                   // position
  // size: 0.5x-1.6x, but at most 3 units either way (a huge circle used as a
  // straight edge would otherwise swallow the tile)
  return Math.max(0.1, Math.min(Math.max(o * between(0.5, 1.6), o - 3), o + 3));
}
function applyTweens(c) {
  for (const tw of tweens) {
    if (tw.start <= c) values.set(tw.key, tw.from + (tw.to - tw.from) * smooth(tw.start, tw.start + tw.dur, c));
  }
}
function updateLive(clock) {                     // works for big jumps too (?t=...)
  while (clock >= nextMutation) {
    applyTweens(nextMutation);
    // 2-4 different numbers change together
    const busy = new Set(tweens.filter((tw) => tw.start + tw.dur > nextMutation).map((tw) => tw.key));
    const keys = mutableKeys().filter((k) => !busy.has(k));
    const glide = (key, to, dur = MUTATE_DUR) => tweens.push({ key, from: values.get(key), to, start: nextMutation, dur });
    let n = 2 + Math.floor(rand() * 3);
    // the number of tiles on screen: its own chance, as it is just one of ~60 numbers.
    // Size and offset move together (offset = size / 2) so the view stays centred.
    if (rand() < VIEW_CHANCE && !busy.has('view:0')) {
      const size = rand() < HOME ? WIDE_VIEW[0] : Math.round(TILE * between(TILES[0], TILES[1]));
      glide('view:0', size);
      glide('view:1', size / 2);
      n--;
    }
    for (; n > 0 && keys.length; n--) {
      const [key] = keys.splice(Math.floor(rand() * keys.length), 1);
      glide(key, round2(targetFor(key)));
    }
    nextMutation += MUTATE_EVERY;
    tweens = tweens.filter((tw) => nextMutation < tw.start + tw.dur + FLASH + MUTATE_EVERY);
  }
  applyTweens(clock);
  liveClock = clock;
}

// the value of a number at time t (view numbers depend on the phase)
// The view while building never moves: every shape whole, then the cut and
// the reflections in the same place. The live phase starts from it too.
const buildView = () => ALL_VIEW;
function valueOf(key, t) {
  if ((key === 'view:0' || key === 'view:1') && t >= total) return values.get(key);   // live: it mutates
  if (key === 'view:0') return buildView()[0];
  if (key === 'view:1') return buildView()[1];
  if (fixed.has(key)) return fixed.get(key);
  return values.get(key);
}

// Before the live phase, the glow number is typed as GLOW_FROM (sharp edges)
// and then glides to its value: the glow comes in.
function setBuildValues(t) {
  const g = firstOf('glow');
  values.set('glow', GLOW_FROM + (P.glow - GLOW_FROM) * smooth(g.start + g.typed, g.start + g.typed + GLOW_GROW, t));
}

// ---------- what is on screen at time t ----------

// a number as written: 3. 0.25 -> .25 -0.1 -> -.1 (0 stays 0.)
const fmt = (v) => {
  let s = String(round2(v));
  if (!s.includes('.')) s += '.';
  return s.replace(/^(-?)0\.(?=\d)/, '$1.');
};
function lineText(l, final = false, t = 0) {
  const s = l.parts.map((p) => (typeof p === 'string' ? p : fmt(final ? 0 : valueOf(p.key, t)))).join('');
  return (l.indent ? '    ' : '') + s;
}

// The displayed lines: the segment's target version, where edits not yet
// reached show their previous version (or nothing), and the current edit is
// partly typed. Each line carries `done` (when it was last finished typing).
function displayAt(t) {
  const seg = segAt(t);
  const live = t >= total;
  const local = t - seg.start;
  const old = new Map(seg.from.map((l) => [l.id, l]));
  const out = [];
  for (const l of seg.to) {
    const e = !live && seg.edits.find((x) => x.id === l.id);
    if (e && local < e.start) {                  // not reached yet
      if (old.has(l.id)) out.push({ ...old.get(l.id), done: lastDone(l.id, t) });
      continue;
    }
    if (e && local < e.start + e.dur) {          // being typed
      out.push({ ...l, typed: (local - e.start) / e.dur });
      continue;
    }
    out.push({ ...l, done: lastDone(l.id, t) });
  }
  return out;
}

// When was line `id` last finished typing (before t)?
function lastDone(id, t) {
  let when = null;
  for (const s of timeline) {
    if (s.start > t) break;
    const e = s.edits.find((x) => x.id === id);
    if (e && s.start + e.start + e.dur <= t) when = s.start + e.start + e.dur;
  }
  return when;
}

// What the GPU runs: the segment's previous version until its typing is done.
function gpuVersion(t) {
  const seg = segAt(t);
  return t >= total || t >= seg.start + seg.typed ? seg.to : seg.from;
}

function gpuSource(lines, t) {
  const keys = [];
  const body = lines
    .map((l) => l.parts.map((p) => (typeof p === 'string' ? p : `V[${keys.push(p.key) - 1}]`)).join(''))
    .flatMap((s) => s.split(/(?<=;) (?=(?:vec2|vec3|float) )/))   // one declaration per line
    // a global can't start from a uniform (`float D = 1e9, glow = V[3];`):
    // those become #defines; the rest stay ordinary declarations
    .map((s) => {
      const m = s.match(/^(float|vec3) (.*V\[.*);$/);
      if (!m) return s;
      return m[2].split(', ').map((item) => {
        const [, name, expr] = item.match(/^(\w+) = (.*)$/);
        return expr.includes('V[') ? `#define ${name} (${expr})` : `${m[1]} ${name} = ${expr};`;
      }).join('\n');
    })
    .join('\n');
  // the displayed Shadertoy-style program, made a full shader, numbers as uniforms
  const text = wrapShadertoy(`uniform float V[${Math.max(keys.length, 1)}];\n${body}`);
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
    if (tw) return Math.max(0, liveClock - (tw.start + tw.dur));
  }
  if (key === 'glow') {                          // gliding in after the glow line is typed
    const g = firstOf('glow'), from = g.start + g.typed;
    return t >= from ? Math.max(0, t - (from + GLOW_GROW)) : null;
  }
  return null;
}

function lineHtml(l, t) {
  if (l.typed !== undefined) {                   // being typed: pink, with a caret
    const s = l.parts.map((p) => (typeof p === 'string' ? p : fmt(valueOf(p.key, t)))).join('');
    return paint(esc(s.slice(0, Math.round(s.length * l.typed))) + '<span class="caret">▌</span>', `rgb(${PINK})`);
  }
  const whole = colour(l.done === null ? null : t - l.done);
  const html = l.parts.map((p) => {
    if (typeof p === 'string') return esc(p);
    const text = esc(fmt(valueOf(p.key, t)));
    return whole ? text : paint(text, colour(numberAge(p.key, t)));
  }).join('');
  return paint(html, whole);
}

// ---------- render ----------

let compiledText = null, scrollMarker = null;
function render() {
  if (!P) return;
  if (time >= total) updateLive(time - total);
  else setBuildValues(time);

  // the GPU: compile when the program's structure changes; numbers go in as uniforms
  const gpu = gpuSource(gpuVersion(time), time);
  if (gpu.text !== compiledText) {
    const err = renderer.load(gpu.text);
    errorEl.style.display = err ? 'block' : 'none';
    if (err) errorEl.textContent = 'program failed to compile:\n\n' + err + '\n\n' + gpu.text;
    compiledText = gpu.text;
  }
  renderer.draw({ V: gpu.keys.map((k) => valueOf(k, time)) });

  // the code panel and its size
  const shown = displayAt(time);
  // vim-style cursor line: the line being typed, or whose numbers are changing
  const active = (l) => l.typed !== undefined || l.parts.some((p) => {
    if (typeof p === 'string') return false;
    const age = numberAge(p.key, time);
    return age !== null && age < FLASH;
  });
  codeEl.innerHTML = shown.map((l) =>
    `<div class="ln${l.indent ? ' in' : ''}${active(l) ? ' cur' : ''}">${lineHtml(l, time) || '&nbsp;'}</div>`).join('');
  const text = shown.map((l) => {
    const s = lineText(l, false, time);
    return l.typed !== undefined ? s.slice(0, (l.indent ? 4 : 0) + Math.round((s.length - (l.indent ? 4 : 0)) * l.typed)) : s;
  }).join('\n');
  sizeEl.textContent = `${new TextEncoder().encode(text).length} bytes · ${shown.length} lines`;

  // the Questions button: once the last lines (the glow) have been typed, plus a beat;
  // always while the questions are open, so there's a way back
  const written = firstOf('glow');
  toggleEl.classList.toggle('shown',
    panelEl.classList.contains('q') || time >= written.start + written.typed + TOGGLE_AFTER);

  // keep whatever is being typed or just turned pink in view
  const marker = `${segAt(time).start}|${nextMutation}|${shown.length}`;
  if (marker !== scrollMarker || shown.some((l) => l.typed !== undefined)) {
    scrollMarker = marker;
    const fresh = codeEl.querySelector('.caret') || codeEl.querySelector('span[style]');
    if (fresh) fresh.scrollIntoView({ block: 'nearest' });
  }
}

function resize() {
  // leave room for the 560px code panel + gaps on the right, buttons below,
  // the toggle above and the byte counter at the bottom
  const pad = getComputedStyle(document.body);   // top/bottom padding, then the 40px buttons + 10px gap
  const free = window.innerHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom) - 52;
  const size = Math.floor(Math.max(240, Math.min(free,
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
document.getElementById('rewind').onclick = () => { time = 0; scrollMarker = null; if (P) resetValues(); };
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); playing = !playing; }
});

// A square window centred on the first square tile (the 32x32 square around
// the origin that the reflections make) and big enough for every shape, in
// the program's [size, offset] form: the window is [-offset, size - offset]
// on both axes. Zooming in the live phase stays centred on the origin too.
function allShapesView(calls) {
  let lo = 0, hi = 16;                           // the triangle
  for (const { shape, ring, args: a } of calls) {
    const rx = shape === 'circle' ? a[2] + (ring ? a[3] : 0) : a[2];           // reach from the centre
    const ry = shape === 'circle' ? rx : a[3];
    const xs = shape === 'tri' ? [a[0], a[1]] : [a[0] - rx, a[0] + rx];
    const ys = shape === 'tri' ? [0, a[2]] : [a[1] - ry, a[1] + ry];
    lo = Math.min(lo, ...xs, ...ys);
    hi = Math.max(hi, ...xs, ...ys);
  }
  const half = Math.ceil(Math.max(-lo, hi) + 1);
  return [2 * half, half];
}

async function load() {
  P = parseProgram(await fetchShader('test.frag'));
  ALL_VIEW = allShapesView(P.calls);
  resetValues();
  buildTimeline();
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
