// The build animation: pattern.frag's program written out piece by piece.
//
// The program is a sequence of versions (empty sheet, + each shape, drawn
// whole, + the cut to the triangle, + each reflection stage, + the glow,
// + the melt, which then blips by itself with the clock, iTime).
// Going from one version to the next, every new or changed line is typed
// out, and the picture changes only when the typing is done: until then the
// GPU runs the previous version. Number changes are not typed; they glide
// (the view size, the glow coming in, and the endless mutations at the end).
// The melt clock starts at 0 (crisp) when its lines have been typed.
// (Colour is out for now; see git history.)
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
const MELT_HOLD = 1.0;    // after the melt is typed (its blips start right away)
const GLOW_FROM = 30;     // glow number when first typed: sharp edges (lower = more glow)
const START_HOLD = 3.0;   // the empty sheet, with the welcome screen in the empty rows
const CUT_HOLD = 1.2;     // after the cut to the triangle
const END_HOLD = 4.0;     // finished tiling, then the endless mutations start
const MUTATE_EVERY = 2.2; // seconds between mutations
const MUTATE_DUR = 1.4;   // seconds numbers take to glide to their new values
const HOME = 0.35;        // chance a mutation sends a number back to its original value
const MOVE = 6;           // how far a shape's x or y can move from where it started (grid units)
const VIEW_CHANCE = 0.14; // chance a mutation also zooms (changes the number of tiles on screen)
const TILES = [1, 8];     // the mosaic is between 1x1 (one whole tile) and 8x8 tiles when zooming
const TRI_MOVE = 1.5;     // how far a triangle's corner can move sideways (grid units)
const FLASH = 1.2;        // seconds for new code to settle from pink to gray
const TOGGLE_AFTER = 1.0; // the Questions button appears this long after the code is fully written

// world windows: [size, offset] as written in main(): px = size / res; p = xy * px - offset
let ALL_VIEW = [42, 14];       // every shape whole (worked out from the shapes in load())

const canvas = document.getElementById('gl');
const stage = document.getElementById('stage');
const codeEl = document.getElementById('code');
const sizeEl = document.getElementById('size');
const errorEl = document.getElementById('error');
const toggleEl = document.getElementById('toggle');
const panelEl = document.getElementById('panel');
const renderer = createRenderer(canvas);
const params = new URLSearchParams(location.search);
const requestedTime = Number(params.get('t'));
let time = Number.isFinite(requestedTime) ? Math.max(0, requestedTime) : 0;
let playing = !params.has('t');

// ---------- reading pattern.frag ----------

const NUM = /(?<![\w.])(\d+\.\d*|\.\d+|\d+)(?![\w.])/g;   // a number literal
let P = null;   // the parsed program
let loadError = null;
let loadSequence = 0;

const GLSL_NUMBER = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.source;
const SHAPE_CALL = new RegExp(String.raw`^(add|cut)\s*\(\s*((?:abs\s*\(\s*)*)(circle|rect|tri)\s*\(([^()]*)\)((?:\s*\)\s*-\s*${GLSL_NUMBER})*)\s*\)\s*;$`);
const SHAPE_ARG = new RegExp(String.raw`^([+-]?\s*${GLSL_NUMBER})(\s*[+-]\s*melt(?:\s*[*/]\s*${GLSL_NUMBER})?)?$`);
const MODULO = new RegExp(String.raw`^p\s*=\s*abs\s*\(\s*mod\s*\(\s*u\s*\*\s*(${GLSL_NUMBER})\s*\/\s*iResolution\.y\s*([+-]\s*${GLSL_NUMBER})\s*,\s*(${GLSL_NUMBER})\s*\)\s*([+-])\s*(${GLSL_NUMBER})\s*\)\s*;$`);
const GLOW = new RegExp(String.raw`^(o\s*=\s*vec4\s*\(\s*vec3\s*\(\s*exp\s*\(\s*-\s*\(\s*)(${GLSL_NUMBER})(.*?)(\)\s*\*\s*max\s*\(\s*D\s*,\s*0\.?\s*\)\s*\)\s*\)\s*,\s*1\.?\s*\)\s*;)$`);

function parseProgram(src) {
  const lines = src.split('\n').map((text, i) => ({
    number: i + 1,
    text: text.replace(/\/\/.*$/, '').trim(),
  })).filter((line) => line.text);
  const unsupported = (line, expected) => {
    const at = line ? `:${line.number}` : '';
    throw new Error(`pattern.frag${at}: expected ${expected}${line ? `\n${line.text}` : ''}`);
  };
  const main = lines.findIndex(({ text }) => /^void\s+mainImage\b/.test(text));
  if (main < 0) unsupported(null, 'a mainImage function');
  if (!/^void\s+mainImage\s*\(\s*out\s+vec4\s+o\s*,\s*vec2\s+u\s*\)\s*\{$/.test(lines[main].text)) {
    unsupported(lines[main], 'void mainImage(out vec4 o, vec2 u) {');
  }
  const close = lines.findIndex(({ text }, i) => i > main && text === '}');
  if (close < 0) unsupported(lines.at(-1), 'the closing mainImage brace');
  if (close !== lines.length - 1) unsupported(lines[close + 1], 'the end of the shader');

  const globals = lines.slice(0, main);
  const declarations = {
    D: /^vec2\s+p\s*;\s*float\s+D\s*=\s*[^,;]+,\s*melt\s*;$/,
    smin: /^float\s+smin\s*\(.*\)\s*\{.*\}$/,
    add: /^void\s+add\s*\(.*\)\s*\{.*\}$/,
    cut: /^void\s+cut\s*\(.*\)\s*\{.*\}$/,
    circle: /^float\s+circle\s*\(.*\)\s*\{.*\}$/,
    rect: /^float\s+rect\s*\(.*\)\s*\{.*\}$/,
    tri: /^float\s+tri\s*\(.*\)\s*\{.*\}$/,
  };
  const defs = {};
  for (const line of globals) {
    const name = Object.keys(declarations).find((key) => declarations[key].test(line.text));
    if (!name || defs[name]) unsupported(line, 'a single definition of p/D/melt or a drawing helper');
    defs[name] = line;
  }
  for (const name of Object.keys(declarations)) {
    if (!defs[name]) unsupported(lines[main], `the ${name} declaration before mainImage`);
  }

  const body = lines.slice(main + 1, close);
  const modIndex = body.findIndex(({ text }) => /^p\s*=/.test(text));
  const modLine = body[modIndex];
  const mod = modLine?.text.match(MODULO);
  if (!mod) unsupported(modLine ?? lines[main], 'p = abs(mod(u * scale / iResolution.y + shift, period) - centre);');
  const scale = Number(mod[1]), shift = Number(mod[2].replace(/\s/g, '')), modPeriod = Number(mod[3]);
  if (![scale, shift, modPeriod, Number(mod[5])].every(Number.isFinite) || scale <= 0 || modPeriod <= 0) {
    unsupported(modLine, 'finite fold parameters and a positive scale and period');
  }

  const foldLine = body[modIndex + 1];
  const fold = foldLine?.text.match(/^p\s*=\s*min\s*\(\s*p\s*,\s*(.+?)\s*-\s*p\.yx\s*\)\s*;$/);
  const foldBase = fold?.[1].match(new RegExp(`^${GLSL_NUMBER}`));
  if (!foldBase) unsupported(foldLine ?? modLine, 'p = min(p, seam - p.yx);');

  const meltLines = body.slice(0, modIndex);
  for (const line of meltLines) {
    if (!/^(?:float\s+\w+|melt)\s*=.+;\s*$/.test(line.text)) {
      unsupported(line, 'a scalar declaration or melt assignment before the fold');
    }
  }
  const meltIndex = meltLines.findIndex(({ text }) => /^melt\s*=/.test(text));
  if (meltIndex < 0) unsupported(modLine, 'a melt assignment before the fold');

  const output = body.at(-1);
  const glow = output?.text.match(GLOW);
  if (!glow || !Number.isFinite(Number(glow[2]))) {
    unsupported(output ?? lines[main], 'an output using exp(-(glow) * max(D, 0.))');
  }

  const calls = body.slice(modIndex + 2, -1).map((line) => {
    const match = line.text.match(SHAPE_CALL);
    if (!match) unsupported(line, 'an add or cut call using circle, rect, or tri');
    const [, colour, abs, shape, args, widthsText] = match;
    // Optional abs() around a shape makes a ring. Widths follow the shape's own arguments.
    const widths = [...widthsText.matchAll(new RegExp(String.raw`\)\s*-\s*(${GLSL_NUMBER})`, 'g'))]
      .map((m) => Number(m[1]));
    const own = args.split(',').map((arg) => arg.trim().match(SHAPE_ARG));
    const count = { circle: 3, rect: 4, tri: 2 }[shape];
    if (own.length !== count || own.some((arg) => !arg) || widths.length !== (abs.match(/\(/g) || []).length) {
      unsupported(line, 'numeric shape arguments and matching ring widths, with an optional melt term');
    }
    const values = [...own.map((arg) => Number(arg[1].replace(/\s/g, ''))), ...widths];
    if (!values.every(Number.isFinite)) unsupported(line, 'finite shape arguments');
    return { colour, shape, rings: widths.length, tails: own.map((arg) => arg[2] || ''), args: values };
  });
  if (!calls.length) unsupported(foldLine, 'at least one shape after the fold');

  const edge = defs.tri.text.match(new RegExp(String.raw`\bp\.x\s*-\s*(${GLSL_NUMBER})`));
  if (!edge || !Number.isFinite(Number(edge[1]))) unsupported(defs.tri, 'a triangle edge written as p.x - edge');
  return {
    mainOpen: lines[main].text,
    D: defs.D.text,
    D0: defs.D.text.replace(/\s*,\s*melt\s*;$/, ';'),
    smin: defs.smin.text,
    add: defs.add.text,
    cut: defs.cut.text,
    add0: 'void add(float d) { D = min(D, d); }',
    cut0: 'void cut(float d) { D = max(D, -d); }',
    shapes: { circle: defs.circle.text, rect: defs.rect.text, tri: defs.tri.text },
    triEdge: Number(edge[1]),
    calls,
    modPeriod,
    // The animation controls scale and viewport offset. Keep the source's shift
    // relative to a viewport centred at half the original scale.
    modOffset: -shift - scale / 2,
    modTail: `, ${mod[3]}) ${mod[4]} ${mod[5]});`,
    pFold: foldLine.text,
    pFold0: `p = min(p, ${foldBase[0]} - p.yx);`,
    seam: fold[1],
    discard: 'if (p.x < 0. || p.y < 0. || p.x + p.y > 16.) discard;',
    outputParts: [glow[1], glow[3] + glow[4]],
    output0: 'o = vec4(vec3(.5 - D / fwidth(D)), 1);',
    glow: Number(glow[2]),
    glowTail: glow[3],
    meltLines: meltLines.map(({ text }) => text),
    meltId: `main:melt${meltIndex}`,
  };
}

// The tiling lines, as built up one reflection stage at a time (stage 4 is pattern.frag's).
// Each is [id, parts]; the first line also carries the view.
function tilingLines(k, melt) {
  const fold = melt ? P.pFold : P.pFold0;
  const view = ['p = u * ', num('view:0'), ' / iResolution.y - ', num('view:1'), ';'];
  if (k === 0) return [['main:p', view]];
  if (k === 4) return [['main:p', ['p = abs(mod(u * ', num('view:0'), ' / iResolution.y - ', num('view:m'), P.modTail]],
                       ['main:fold', [fold]]];
  return [['main:p', view],
          ['main:mirror', [k === 1 ? 'p.x = abs(p.x);' : 'p = abs(p);']],
          ...(k === 3 ? [['main:fold', [fold]]] : [])];
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


// The program after `n` shapes, cut to the triangle or not, at reflection
// stage `k`, with or without the glow.
function version({ n, cut, k, glow, melt }) {
  const L = [];
  const line = (id, parts, indent = 0) => L.push({ id, parts: typeof parts === 'string' ? [parts] : parts, indent });
  const calls = P.calls.slice(0, n);
  const used = new Set(calls.flatMap((c) => [c.colour, c.shape]));
  line('g:D', melt ? P.D : P.D0);
  if (melt) line('def:smin', P.smin);
  if (used.has('add')) line('def:add', melt ? P.add : P.add0);
  if (used.has('cut')) line('def:cut', melt ? P.cut : P.cut0);
  for (const s of ['circle', 'rect', 'tri']) if (used.has(s)) line(`def:${s}`, P.shapes[s]);
  line('main:gap', '');
  line('main:open', P.mainOpen);
  if (melt) P.meltLines.forEach((l, i) => line(`main:melt${i}`, l, 1));
  for (const [id, parts] of tilingLines(k, melt)) line(id, parts, 1);
  if (cut && k < 4) line('main:discard', numbered(P.discard, 'disc'), 1);   // not needed once the tiling is complete
  calls.forEach((c, i) => {
    const parts = [`${c.colour}(${'abs('.repeat(c.rings)}${c.shape}(`];
    const own = c.args.length - c.rings;         // the shape's args, then its ring widths
    c.args.forEach((_, j) => {
      parts.push(j === own ? ')) - ' : j > own ? ') - ' : j ? ', ' : '');
      parts.push(num(`c${i}:${j}`));
      if (melt && c.tails[j]) parts.push(c.tails[j]);   // e.g. ` + melt`: only once melt exists
    });
    parts.push(c.rings ? ');' : '));');
    line(`call:${i}`, parts, 1);
  });
  // only the glow number is a number here; the rest is written exactly as in pattern.frag
  const [pre, post] = P.outputParts;
  line('main:out', glow ? [pre, num('glow'), post] : P.output0, 1);
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
  states.push({ ...done, glow: true, melt: true }); kinds.push(['melt', MELT_HOLD]);
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
    const previous = new Map(t[i - 1]?.finished);
    const finished = new Map(previous);
    for (const edit of edits) finished.set(edit.id, at + edit.start + edit.dur);
    const editsByLine = new Map(edits.map((edit) => [edit.id, edit]));
    const seg = { kind, from, to, old, previous, finished, editsByLine, start: at, typed, dur: typed + hold };
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

const requestedSeed = params.has('seed') ? Number(params.get('seed')) : NaN;
const initialSeed = (Number.isFinite(requestedSeed) ? requestedSeed : Math.random() * 2 ** 32) >>> 0;
let seed = initialSeed;
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
  const lines = [[P.discard, 'disc']];
  for (const [text, prefix] of lines) {
    [...text.matchAll(NUM)].forEach((x, n) => m.set(`${prefix}:${n}`, Number(x[0])));
  }
  return m;
}
let fixed = new Map();

function resetValues() {
  seed = initialSeed;
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

// Mutable one number at a time: shape positions (args 0, 1) and sizes (the rest).
// A triangle tri(a, h) is (a,0) (9.5,0) (9.5,h): its corner a moves
// less, so it can't turn inside out, and h is a size. (The zoom has its own chance, below.)
const mutableKeys = () => [...original.keys()].filter((k) => k !== 'glow');   // the glow keeps its own rhythm
function targetFor(key) {
  const o = original.get(key);
  if (rand() < HOME) return o;
  const [i, j] = key.slice(1).split(':').map(Number);
  if (P.calls[i].shape === 'tri') {
    if (j === 0) return Math.min(o + between(-TRI_MOVE, TRI_MOVE), P.triEdge - 0.5);   // the corner's x
  } else
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
      const size = rand() < HOME ? P.modPeriod * 5 : Math.round(P.modPeriod * between(TILES[0], TILES[1]));
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
  if (key === 'view:m') return valueOf('view:1', t) + P.modOffset;   // the offset as written inside the mod
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
  const local = t - seg.start;
  const out = [];
  for (const l of seg.to) {
    const e = seg.editsByLine.get(l.id);
    if (e && local < e.start) {                  // not reached yet
      if (seg.old.has(l.id)) out.push({ ...seg.old.get(l.id), done: seg.previous.get(l.id) ?? null });
      continue;
    }
    if (e && local < e.start + e.dur) {          // being typed
      out.push({ ...l, typed: (local - e.start) / e.dur });
      continue;
    }
    out.push({ ...l, done: seg.finished.get(l.id) ?? null });
  }
  return out;
}

// What the GPU runs: the segment's previous version until its typing is done.
function gpuVersion(t) {
  const seg = segAt(t);
  return t >= total || t >= seg.start + seg.typed ? seg.to : seg.from;
}

const gpuPrograms = new WeakMap();
function gpuSource(lines) {
  const cached = gpuPrograms.get(lines);
  if (cached) return cached;
  const keys = [];
  const body = lines
    .map((l) => l.parts.map((p) => (typeof p === 'string' ? p : `V[${keys.push(p.key) - 1}]`)).join(''))
    .join('\n');
  // the displayed Shadertoy-style program, made a full shader, numbers as uniforms
  const text = wrapShadertoy(`uniform float V[${Math.max(keys.length, 1)}];\n${body}`);
  const program = { text, keys };
  gpuPrograms.set(lines, program);
  return program;
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
  if (key === 'view:m') key = 'view:1';
  if (t >= total) {
    const tw = tweens.findLast((x) => x.key === key && x.start <= liveClock);
    if (tw) return Math.max(0, liveClock - (tw.start + tw.dur));
  }
  if (key === 'glow') {                          // gliding in after the glow line is typed
    const g = firstOf('glow'), from = g.start + g.typed;
    return t >= from ? Math.max(0, t - (from + GLOW_GROW)) : null;
  }
  return null;
}

// Typed text with Vim's matching brackets: when a ) ] or } was typed in the last
// moment (MATCH_CHARS characters ago at most), it and its partner on the line light up.
const MATCH_CHARS = Math.round(0.3 * CPS);
function typedHtml(typed) {
  const lit = new Set();
  for (let i = typed.length - 1; i >= Math.max(0, typed.length - MATCH_CHARS); i--) {
    const open = { ')': '(', ']': '[', '}': '{' }[typed[i]];
    if (!open) continue;
    for (let j = i, depth = 0; j >= 0; j--) {
      if (typed[j] === typed[i]) depth++;
      else if (typed[j] === open && --depth === 0) { lit.add(i).add(j); break; }
    }
    break;                                       // only the most recent closing bracket
  }
  return [...typed].map((c, i) => (lit.has(i) ? `<span class="mp">${esc(c)}</span>` : esc(c))).join('');
}

// pink by k (0 = the usual gray, 1 = full pink)
const pinkBy = (k) => `rgb(${GRAY.map((g, i) => Math.round(g + (PINK[i] - g) * k))})`;

// `r`: the rhythm of a line driven by the clock (the melt, the glow): { k, label }
function lineHtml(l, t, r) {
  if (l.typed !== undefined) {                   // being typed: pink, with a caret
    const s = l.parts.map((p) => (typeof p === 'string' ? p : fmt(valueOf(p.key, t)))).join('');
    return paint(typedHtml(s.slice(0, Math.round(s.length * l.typed))) + '<span class="caret">▌</span>', `rgb(${PINK})`);
  }
  const whole = colour(l.done === null ? null : t - l.done);
  const html = l.parts.map((p) => {
    if (typeof p === 'string') return esc(p);
    const text = esc(fmt(valueOf(p.key, t)));
    return whole ? text : paint(text, colour(numberAge(p.key, t)));
  }).join('');
  if (r && !whole) return paint(html, pinkBy(r.k)) + `<span class="vt">${r.label}</span>`;
  return paint(html, whole);
}

// ---------- render ----------

function prepareRhythms(program) {
  const js = (s) => s.replace(/\bfloat\b/g, 'let')
    .replace(/\b(floor|exp|cos|sin|abs|sqrt|max|min)\s*\(/g, 'Math.$1(');
  const fract = 'const fract = (x) => x - Math.floor(x);';
  const range = (at, count) => {
    const samples = Array.from({ length: count }, (_, i) => at(i / 100));
    return [Math.min(...samples), Math.max(...samples)];
  };
  try {
    const meltAt = new Function('iTime', `${fract} let melt; ${program.meltLines.map(js).join(' ')} return melt;`);
    const glowAt = new Function('g', 'iTime', `${fract} return g${js(program.glowTail)};`);
    const seamAt = new Function('iTime', `${fract} return ${js(program.seam)};`);
    const heartbeats = new Map();
    program.calls.forEach((call, i) => {
      const j = call.tails.findIndex((tail) => /\bmelt\b/.test(tail));
      if (j < 0) return;
      const tail = call.tails[j];
      heartbeats.set(`call:${i}`, {
        key: `c${i}:${j}`, tail, extra: new Function('melt', `return ${js(tail)};`),
      });
    });
    program.rhythms = {
      meltAt, glowAt, seamAt, heartbeats,
      meltId: program.meltId,
      glowRange: range((t) => glowAt(program.glow, t), 2000),
      seamRange: range(seamAt, 4000),
    };
  } catch {
    program.rhythms = null;                     // clock annotations are optional
  }
}

function codeRhythms(shown, iTime) {
  const rhythm = new Map();
  if (!P.rhythms) return rhythm;
  const { meltAt, meltId, glowAt, glowRange, seamAt, seamRange, heartbeats } = P.rhythms;
  const melt = meltAt(iTime);
  const meltPink = Math.min(1, melt / 0.6);
  for (const l of shown) {
    if (l.id === meltId) {
      rhythm.set(l.id, { k: meltPink, label: `// melt = ${melt.toFixed(2)}` });
    } else if (l.id === 'main:out' && l.parts.some((p) => p.key === 'glow')) {
      const g = glowAt(valueOf('glow', time), iTime), [lo, hi] = glowRange;
      rhythm.set(l.id, { k: Math.min(1, Math.max(0, (g - lo) / (hi - lo || 1))), label: `// glow = ${g.toFixed(1)}` });
    } else if (l.id === 'main:fold' && l.parts[0] === P.pFold && P.pFold !== P.pFold0) {
      const v = seamAt(iTime), [lo, hi] = seamRange, mid = (lo + hi) / 2;
      rhythm.set(l.id, { k: Math.min(1, Math.abs(v - mid) / ((hi - lo) / 2 || 1)), label: `// seam = ${v.toFixed(2)}` });
    } else {
      const beat = heartbeats.get(l.id);
      if (beat && l.parts.includes(beat.tail)) {
        const radius = valueOf(beat.key, time) + beat.extra(melt);
        rhythm.set(l.id, { k: meltPink, label: `// r = ${radius.toFixed(2)}` });
      }
    }
  }
  return rhythm;
}

let compiledText = null, scrollMarker = null;
const encoder = new TextEncoder();
function render() {
  if (!P) return;
  if (time >= total) updateLive(time - total);
  else setBuildValues(time);

  // the GPU: compile when the program's structure changes; numbers go in as uniforms
  const gpu = gpuSource(gpuVersion(time));
  if (gpu.text !== compiledText) {
    const err = renderer.load(gpu.text);
    if (!loadError) {
      errorEl.style.display = err ? 'block' : 'none';
      if (err) errorEl.textContent = 'program failed to compile:\n\n' + err + '\n\n' + gpu.text;
    }
    compiledText = gpu.text;
  }
  // the clock the melt waves by: 0 (crisp) until its line is typed, then running
  const m = firstOf('melt');
  const iTime = Math.max(0, time - (m.start + m.typed));
  renderer.draw({ V: gpu.keys.map((k) => valueOf(k, time)), iTime });
  renderCode(iTime, m);
}

function renderCode(iTime, meltSegment) {
  // the code panel and its size
  const shown = displayAt(time);
  // vim-style cursor line: the line being typed, or whose numbers are changing
  const active = (l) => l.typed !== undefined || l.parts.some((p) => {
    if (typeof p === 'string') return false;
    const age = numberAge(p.key, time);
    return age !== null && age < FLASH;
  });
  const rhythm = codeRhythms(shown, iTime);
  codeEl.innerHTML = shown.map((l) => {
    const r = l.typed === undefined && rhythm.get(l.id), on = active(l);
    const bg = r && !on ? ` style="background: rgba(255, 232, 243, ${r.k.toFixed(3)})"` : '';
    return `<div class="ln${l.indent ? ' in' : ''}${on ? ' cur' : ''}"${bg}>${lineHtml(l, time, r) || '&nbsp;'}</div>`;
  }).join('');
  tildes(segAt(time).kind === 'start' && time < total);
  const text = shown.map((l) => {
    const s = lineText(l, false, time);
    return l.typed !== undefined ? s.slice(0, (l.indent ? 4 : 0) + Math.round((s.length - (l.indent ? 4 : 0)) * l.typed)) : s;
  }).join('\n');
  // a Vim command line: the size so far, then a blinking block cursor
  sizeEl.innerHTML = `:${encoder.encode(text).length} bytes · ${shown.length} lines<span class="blk">█</span>`;

  // the Questions button: once the last lines (the melt) have been typed, plus a beat;
  // always while the questions are open, so there's a way back
  toggleEl.classList.toggle('shown',
    panelEl.classList.contains('q') || time >= meltSegment.start + meltSegment.typed + TOGGLE_AFTER);

  // keep whatever is being typed or just turned pink in view
  const marker = `${segAt(time).start}|${nextMutation}|${shown.length}`;
  if (marker !== scrollMarker || shown.some((l) => l.typed !== undefined)) {
    scrollMarker = marker;
    const fresh = codeEl.querySelector('.caret') || codeEl.querySelector('span[style]');
    if (fresh) fresh.scrollIntoView({ block: 'nearest' });
  }
}

// Vim's ~ on every empty row below the end of the file; at the start (the empty
// sheet) the middle ones carry a welcome screen, as Vim's does.
function welcome() {
  return [['block pattern', 't'],
          [''], ...['click  ❚❚  to pause', 'click  ◀◀  to start over']
            .map((l, _, all) => [l.padEnd(Math.max(...all.map((x) => x.length))).replace(/ /g, '\u00a0')])];   // as one block
}
function tildes(intro) {
  const cs = getComputedStyle(codeEl);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.55;   // one row
  const last = codeEl.lastElementChild;          // where the code's own rows end
  const used = last ? last.offsetTop + last.offsetHeight - codeEl.offsetTop : 0;
  const free = Math.floor((codeEl.clientHeight - used - 1) / lh);
  if (free <= 0) return;
  const text = intro ? welcome() : [];
  const first = text.length <= free - 2 ? Math.floor((free - text.length) / 2) : Infinity;   // centred, if it fits
  let html = '';
  for (let i = 0; i < free; i++) {
    const [line, cls] = text[i - first] || [];
    html += `<div class="ln tl">~${line ? `<span class="intro${cls ? ' ' + cls : ''}">${esc(line)}</span>` : ''}</div>`;
  }
  codeEl.insertAdjacentHTML('beforeend', html);
}

// The code font: 13px (11px on a phone on its side) at most, and smaller if the finished
// program wouldn't fit in the box beside the square; never below 9px (then it scrolls).
function fitCode(compact) {
  if (!P || !timeline.length) return;
  const final = timeline[timeline.length - 1].to;
  const label = (l) => (/^main:melt/.test(l.id) && /^ *melt = /.test(lineText(l)) ? '// melt = 0.00'
    : l.id === 'main:out' ? '// glow = 12.0' : l.id === 'main:fold' ? '// seam = 16.40'
    : /^call:/.test(l.id) && lineText(l).includes('melt') ? '// r = 5.25' : '');   // the live values shown after the clock-driven lines
  const html = final.map((l) => `<div class="ln${l.indent ? ' in' : ''}">${esc(lineText(l, false, total)).replace(/^ {4}/, '') || '&nbsp;'}${
    label(l) ? `<span class="vt">${label(l)}</span>` : ''}</div>`).join('');
  const box = codeEl.clientHeight, max = compact ? 11 : 13;
  const fits = (px) => {
    document.body.style.setProperty('--code-size', px + 'px');
    codeEl.innerHTML = html;                     // render() replaces it on the next frame
    const last = codeEl.lastElementChild;
    return last.offsetTop + last.offsetHeight - codeEl.offsetTop <= box;
  };
  // the biggest size that fits, in quarter pixels: guess from the overflow, then step to it
  let px = max;
  if (!fits(px)) {
    const last = codeEl.lastElementChild;
    px = Math.max(9, Math.floor(max * box / (last.offsetTop + last.offsetHeight - codeEl.offsetTop) * 4) / 4);
    while (px > 9 && !fits(px)) px -= 0.25;
    while (px + 0.25 <= max && fits(px + 0.25)) px += 0.25;
  }
  document.body.style.setProperty('--code-size', px + 'px');
}

function resize() {
  // leave room for the 560px code panel + gaps on the right, buttons below,
  // the toggle above and the byte counter at the bottom
  const pad = getComputedStyle(document.body);   // top/bottom padding, then the buttons + their gap
  const compact = matchMedia('(max-height: 500px)').matches;   // a phone on its side: side by side, tighter
  const controls = document.getElementById('controls').offsetHeight + parseFloat(getComputedStyle(stage.parentNode).rowGap || 0) + 2;
  const free = window.innerHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom) - controls;
  const across = window.innerWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
  const size = Math.floor(Math.max(compact ? 120 : 240, Math.min(free,
    compact ? across * 0.45 : window.innerWidth >= 900 ? window.innerWidth - 640 : window.innerWidth - 32)));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = canvas.style.height = size + 'px';
  canvas.width = canvas.height = Math.round(size * dpr);
  stage.style.width = size + 'px';
  document.body.style.setProperty('--img', size + 'px');   // the code box matches the square
  fitCode(compact);
  render();
}

// ---------- playback ----------

let last = 0, frameId = null;
function scheduleFrame() {
  if (!playing || !P || frameId !== null) return;
  last = performance.now();
  frameId = requestAnimationFrame(frame);
}

function frame(now) {
  time += Math.min(Math.max(0, (now - last) / 1000), 0.1);
  last = now;
  render();
  frameId = requestAnimationFrame(frame);
}

// one play / pause button: its icon shows what a click will do
const playEl = document.getElementById('play');
function setPlaying(p) {
  playing = p;
  playEl.classList.toggle('paused', !p);
  playEl.title = p ? 'pause (space)' : 'play (space)';
  playEl.setAttribute('aria-label', p ? 'pause' : 'play');
  if (playing) scheduleFrame();
  else if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
}
playEl.onclick = () => { setPlaying(!playing); playEl.blur(); };   // so Space doesn't also click it
setPlaying(playing);
document.getElementById('rewind').onclick = () => {
  time = 0;
  scrollMarker = null;
  if (!P) return;
  resetValues();
  render();
};
// Local testing: skip the build and land where the code is complete and the numbers start
// changing (only shown on localhost, so the published page doesn't have it).
const skipEl = document.getElementById('skip');
skipEl.hidden = !['localhost', '127.0.0.1'].includes(location.hostname);
skipEl.onclick = () => {
  if (!P) return;
  time = Math.max(time, firstOf('end').start); scrollMarker = null; setPlaying(true); skipEl.blur();
};
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
});
toggleEl.addEventListener('click', () => {
  requestAnimationFrame(() => {
    if (panelEl.classList.contains('q')) return;
    fitCode(matchMedia('(max-height: 500px)').matches);
    render();
  });
});

// A square window centred on the first square tile (the 32x32 square around
// the origin that the reflections make) and big enough for every shape, in
// the program's [size, offset] form: the window is [-offset, size - offset]
// on both axes. Zooming in the live phase stays centred on the origin too.
function allShapesView(calls) {
  let lo = 0, hi = 16;                           // the triangle
  for (const { shape, args: a } of calls) {
    const rx = shape === 'circle' ? a.slice(2).reduce((x, y) => x + y) : a[2];   // reach from the centre (+ ring widths)
    const ry = shape === 'circle' ? rx : a[3];
    const xs = shape === 'tri' ? [a[0], P.triEdge] : [a[0] - rx, a[0] + rx];
    const ys = shape === 'tri' ? [0, a[1]] : [a[1] - ry, a[1] + ry];
    lo = Math.min(lo, ...xs, ...ys);
    hi = Math.max(hi, ...xs, ...ys);
  }
  const half = Math.ceil(Math.max(-lo, hi) + 1);
  return [2 * half, half];
}

async function load() {
  const sequence = ++loadSequence;
  let nextProgram;
  try {
    const src = await fetchShader('pattern.frag');
    if (sequence !== loadSequence) return;
    nextProgram = parseProgram(src);
    prepareRhythms(nextProgram);
  } catch (err) {
    if (sequence !== loadSequence) return;
    loadError = err.message;
    errorEl.textContent = loadError;
    errorEl.style.display = 'block';
    return;
  }
  loadError = null;
  errorEl.style.display = 'none';
  P = nextProgram;
  ALL_VIEW = allShapesView(P.calls);
  resetValues();
  buildTimeline();
  fitCode(matchMedia('(max-height: 500px)').matches);
  render();
  scheduleFrame();
}

onFileChange((name) => {
  if (name === 'pattern.frag') load();
  else if (['animate.js', 'index.html', 'renderer.js'].includes(name)) location.reload();
});

window.addEventListener('resize', resize);
resize();
load();
