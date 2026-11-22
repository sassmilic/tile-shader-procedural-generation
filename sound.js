// The sound page: the mosaic plays hyperpop.
//
// Everything is read from the animation (window.tile, see the end of animate.js) once per frame,
// and notes are scheduled a little ahead on the audio clock. The picture is the score:
//
//   the clock (iTime, from when the melt is typed: the drop) — one 2 s slot = one bar at 120 BPM
//     melt blip (once a bar, at a golden-ratio offset)  -> 808 kick, its strength the velocity
//     glow crisp (the middle of each bar)               -> snare / clap
//     glow blurriest (the bar line)                     -> open hat; the pad's filter follows the glow
//     the bar's golden-ratio r                          -> the bass note (and the pad chord on it)
//     the sway (the mirror's seam)                      -> the pad's stereo width, the hats' pan
//     the zoom (tiles across)                           -> hi-hat density; zoom glides are risers
//   the shapes (one voice each: circle / rect / tri families)
//     size -> pitch (bigger = lower, on the scale), x -> pan, y -> brightness, cut -> swell, octave down
//     drawn in the build -> one note; a random change glides a number -> the note glides with it
//
// Synthesized for now (Tone.js); the controls are built from PARAMS below and saved locally.

(() => {   // its own scope: animate.js already has globals like render, last, fmt

// ---------------------------------------------------------------- parameters

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = {
  pentatonic: [0, 3, 5, 7, 10], minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
};
const INSTRUMENTS = ['stab', 'glitch', 'bell', 'pluck', 'chip'];

// { id, label, section, min, max, step, def } or { ..., options, def }; `ch` = the channel it levels/mutes
const PARAMS = [
  { section: 'master' },
  { id: 'volume', label: 'volume', min: -40, max: 6, step: 1, def: -10, unit: 'dB' },
  { id: 'lowCut', label: 'low cut', min: 20, max: 200, step: 5, def: 70, unit: ' Hz' },   // small speakers can't do deep bass
  { id: 'key', label: 'key', options: KEYS, def: 'A' },
  { id: 'scale', label: 'scale', options: Object.keys(SCALES), def: 'pentatonic' },
  { section: 'drums' },
  { id: 'kick', label: 'kick', min: -40, max: 6, step: 1, def: 0, unit: 'dB', ch: 'kick' },
  { id: 'kickPattern', label: '  pattern', options: ['blip', 'blip + one', 'four on floor'], def: 'blip' },
  { id: 'kickPitch', label: '  pitch', min: 20, max: 48, step: 1, def: 36, note: true },
  { id: 'kickDecay', label: '  decay', min: 0.1, max: 1.5, step: 0.05, def: 0.6 },
  { id: 'kickDrive', label: '  drive', min: 0, max: 1, step: 0.05, def: 0.15 },
  { id: 'snare', label: 'snare', min: -40, max: 6, step: 1, def: -4, unit: 'dB', ch: 'snare' },
  { id: 'snareType', label: '  type', options: ['clap', 'snare', 'glitch'], def: 'clap' },
  { id: 'hats', label: 'hats', min: -40, max: 6, step: 1, def: -14, unit: 'dB', ch: 'hats' },
  { id: 'hatDensity', label: '  density', min: -2, max: 2, step: 1, def: 0 },
  { id: 'swing', label: '  swing', min: 0, max: 0.6, step: 0.05, def: 0.15 },
  { section: 'bass' },
  { id: 'bass', label: 'bass', min: -40, max: 6, step: 1, def: -6, unit: 'dB', ch: 'bass' },
  { id: 'bassType', label: '  type', options: ['808', 'reese', 'square'], def: '808' },
  { id: 'bassGlide', label: '  glide', min: 0, max: 0.5, step: 0.01, def: 0.08, unit: 's' },
  { id: 'bassDrive', label: '  drive', min: 0, max: 1, step: 0.05, def: 0.2 },
  { id: 'bassOct', label: '  octave', min: -1, max: 2, step: 1, def: 1 },
  { section: 'pad' },
  { id: 'pad', label: 'pad', min: -40, max: 6, step: 1, def: -22, unit: 'dB', ch: 'pad' },
  { id: 'padType', label: '  type', options: ['supersaw', 'fm choir', 'organ'], def: 'supersaw' },
  { id: 'padDetune', label: '  detune', min: 0, max: 80, step: 1, def: 30 },
  { id: 'glowFollow', label: '  glow follow', min: 0, max: 1, step: 0.05, def: 0.8 },
  { section: 'shapes' },
  { id: 'seq', label: 'sequencer', options: ['18 steps', 'off'], def: '18 steps' },   // the shapes take turns, one per 16th
  ...['circle', 'rect', 'tri'].flatMap((f) => [
    { id: f, label: f + 's', min: -40, max: 6, step: 1, def: -12, unit: 'dB', ch: f },
    { id: f + 'Inst', label: '  sound', options: INSTRUMENTS, def: { circle: 'stab', rect: 'chip', tri: 'bell' }[f] },
    { id: f + 'Oct', label: '  octave', min: -2, max: 2, step: 1, def: 0 },
    { id: f + 'Len', label: '  length', min: 0.05, max: 1.5, step: 0.05, def: 0.15, unit: 's' },
    { id: f + 'Follow', label: '  accent', options: ['on', 'off'], def: 'on' },   // a shape being changed plays louder and longer
  ]),
  { id: 'panWidth', label: 'pan width', min: 0, max: 1, step: 0.05, def: 0.5 },
  { section: 'fx' },
  { id: 'reverbSize', label: 'reverb size', min: 0.5, max: 12, step: 0.5, def: 2.5, unit: 's' },
  { id: 'reverbMix', label: 'reverb mix', min: 0, max: 1, step: 0.05, def: 0.3 },
  { id: 'delayTime', label: 'delay time', options: ['1/16', '1/8', '1/8 dotted', '1/4'], def: '1/8 dotted' },
  { id: 'delayFeedback', label: 'delay fb', min: 0, max: 0.9, step: 0.05, def: 0.3 },
  { id: 'delayMix', label: 'delay mix', min: 0, max: 1, step: 0.05, def: 0.2 },
  { id: 'crushBits', label: 'crush bits', min: 1, max: 16, step: 1, def: 8 },
  { id: 'crushMix', label: 'crush mix', min: 0, max: 1, step: 0.05, def: 0 },
  { id: 'chorusMix', label: 'chorus mix', min: 0, max: 1, step: 0.05, def: 0 },
  { id: 'duck', label: 'sidechain', min: 0, max: 1, step: 0.05, def: 0.6 },
];
const STORE = 'block-pattern-sound:v3';   // v3: the shapes as a sequencer (older saved settings are left behind)
const defaults = Object.fromEntries(PARAMS.filter((p) => p.id).map((p) => [p.id, p.def]));
let S = { ...defaults, ...JSON.parse(localStorage.getItem(STORE) || '{}') };   // current settings
let muted = new Set(JSON.parse(localStorage.getItem(STORE + ':muted') || '[]'));
const save = () => { localStorage.setItem(STORE, JSON.stringify(S)); localStorage.setItem(STORE + ':muted', JSON.stringify([...muted])); };

// ---------------------------------------------------------------- music helpers

const BAR = 2;                                   // seconds: one slot of the picture's clock
const fract = (x) => x - Math.floor(x);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);
// a scale degree (any integer) to a MIDI note, from a base octave note
function degree(d, base) {
  const sc = SCALES[S.scale], n = sc.length, o = Math.floor(d / n);
  return base + KEYS.indexOf(S.key) + o * 12 + sc[d - o * n];
}
// the picture's clock, as in pattern.frag: bar c, its golden-ratio r, its blip
const barR = (c) => fract(c * 0.618);
const blipAt = (c) => c * BAR + 0.5 + barR(c);   // the moment of the blip in bar c (iTime)
const blipStrength = (c) => 0.25 + barR(c) / 2;

// ---------------------------------------------------------------- the audio graph

let A = null;                                    // built on the first click (browsers need one)
function build() {
  const master = new Tone.Volume(S.volume).toDestination();
  const lowCut = new Tone.Filter(S.lowCut, 'highpass', -24).connect(master);
  const limiter = new Tone.Limiter(-1).connect(lowCut);
  const reverb = new Tone.Reverb({ decay: S.reverbSize, wet: S.reverbMix }).connect(limiter);
  const delay = new Tone.FeedbackDelay({ delayTime: delayTime(), feedback: S.delayFeedback, wet: S.delayMix }).connect(reverb);
  const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.6, wet: 1 }).start();
  const crusher = new Tone.BitCrusher(S.crushBits); crusher.wet.value = 1;
  const music = new Tone.Gain(1);                // ducked by the kick; -> [crusher] -> [chorus] -> delay (see rewire)
  const drums = new Tone.Gain(1).connect(limiter);
  const drumVerb = new Tone.Gain(0.15).connect(reverb); drums.connect(drumVerb);

  const ch = {};                                 // a level per channel (also its mute)
  const channel = (id, dest) => (ch[id] = new Tone.Volume(S[id]).connect(dest));
  ['kick', 'snare', 'hats'].forEach((id) => channel(id, drums));
  ['bass', 'pad', 'circle', 'rect', 'tri'].forEach((id) => channel(id, music));
  channel('fx', music); ch.fx.volume.value = -10;   // risers, whooshes
  muted.forEach((id) => ch[id] && (ch[id].mute = true));

  // drums
  const kickDrive = new Tone.Distortion(S.kickDrive).connect(ch.kick);
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: S.kickDecay, sustain: 0, release: 0.1 } }).connect(kickDrive);
  const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { decay: 0.12, sustain: 0 } }).connect(ch.snare);
  const snareFilter = new Tone.Filter(1800, 'bandpass').connect(ch.snare);
  const snareNoise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }).connect(snareFilter);
  const glitch = new Tone.MetalSynth({ envelope: { decay: 0.08, release: 0.02 }, harmonicity: 8.1, modulationIndex: 40, resonance: 3000 }).connect(ch.snare);
  glitch.volume.value = -12;
  const hatPan = new Tone.Panner(0).connect(ch.hats);
  const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 6000, octaves: 1.5 }).connect(hatPan);
  hat.volume.value = -10;
  const openHat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.35, release: 0.2 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5 }).connect(hatPan);
  openHat.volume.value = -16;

  // bass and pad
  const bassDrive = new Tone.Distortion(S.bassDrive).connect(ch.bass);
  const bass = new Tone.MonoSynth({ portamento: S.bassGlide, envelope: { attack: 0.005, decay: 0.3, sustain: 0.8, release: 0.2 },
                                    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.6, baseFrequency: 120, octaves: 3 } }).connect(bassDrive);
  const padWide = new Tone.StereoWidener(0.5).connect(ch.pad);
  const padFilter = new Tone.Filter(1500, 'lowpass', -24).connect(padWide);
  const fxNoise = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.5, decay: 0.1, sustain: 1, release: 0.3 } });
  const fxFilter = new Tone.Filter(400, 'bandpass', -12).connect(ch.fx); fxNoise.connect(fxFilter);

  const meter = new Tone.Meter({ smoothing: 0, channelCount: 2 }); master.connect(meter);   // testing: both channels
  A = { lowCut, meter, master, reverb, delay, chorus, crusher, music, ch, kick, kickDrive, snareBody, snareNoise, glitch, hat, hatPan, openHat,
        bass, bassDrive, padFilter, padWide, fxNoise, fxFilter, pad: null, voices: [] };
  setBassType(); setPad(); rewire();
}
// the crusher and chorus are only in the path when turned up (they cost processing even when dry):
// their mix knob crossfades between the path through them and a dry path around them
function rewire() {
  const { music, crusher, chorus, delay } = A;
  [music, crusher, chorus].forEach((n) => n.disconnect());
  (A.extra || []).forEach((n) => n.dispose());
  A.extra = [];
  let at = music;
  if (S.crushMix > 0) {                          // music -> crusher (mix) + dry (1 - mix) -> sum
    const sum = new Tone.Gain(1), wet = new Tone.Gain(S.crushMix).connect(sum), dry = new Tone.Gain(1 - S.crushMix).connect(sum);
    at.connect(crusher); crusher.connect(wet); at.connect(dry);
    A.extra.push(sum, wet, dry); at = sum;
  }
  if (S.chorusMix > 0) { chorus.wet.value = S.chorusMix; at.connect(chorus); at = chorus; }
  at.connect(delay);
}
const delayTime = () => ({ '1/16': '16n', '1/8': '8n', '1/8 dotted': '8n.', '1/4': '4n' })[S.delayTime];
function setBassType() {
  A.bass.oscillator.type = { '808': 'sine', reese: 'fatsawtooth', square: 'square' }[S.bassType];
  if (S.bassType === 'reese') { A.bass.oscillator.count = 2; A.bass.oscillator.spread = 25; }
  A.bass.filter.frequency.value = S.bassType === '808' ? 2000 : 900;
}
function setPad() {
  if (A.pad) { A.pad.releaseAll(); A.pad.dispose(); }
  const t = S.padType;
  A.pad = t === 'fm choir'
    ? new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2, modulationIndex: 3, envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 1.2 } })
    : new Tone.PolySynth(Tone.Synth, { oscillator: t === 'organ' ? { type: 'fatsine', count: 2, spread: S.padDetune } : { type: 'fatsawtooth', count: 2, spread: S.padDetune },
                                       envelope: { attack: 0.25, decay: 0.3, sustain: 0.7, release: 1.2 } });
  A.pad.maxPolyphony = 12;
  A.pad.connect(A.padFilter);
}

// Tone won't start an instrument at or before its previous start ("Start time must be strictly
// greater than previous start time"), which happens when two things land together (the drop's
// kick and the first beat, two changes to one shape). So every start goes through this.
const lastStart = new WeakMap();
function safe(inst, at) {
  const t = Math.max(at, (lastStart.get(inst) ?? 0) + 0.003, Tone.now());
  lastStart.set(inst, t);
  return t;
}

// ---------------------------------------------------------------- the shapes' voices

const family = (c) => c.shape;                   // circle / rect / tri
function makeSynth(inst, cut, len) {
  const att = cut ? Math.min(len * 0.6, 0.05) : 0.003;   // a cut shape swells in (briefly: notes are 16ths)
  switch (inst) {
    case 'stab': return new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 30 }, envelope: { attack: att, decay: 0.12, sustain: 0.35, release: len } });
    // gentle: square-on-square FM pushed hard sounded like broken speakers
    case 'glitch': return new Tone.FMSynth({ harmonicity: 2, modulationIndex: 3, oscillator: { type: 'triangle' }, modulation: { type: 'square' },
                                             envelope: { attack: att, decay: 0.08, sustain: 0.25, release: len * 0.5 },
                                             modulationEnvelope: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.05 } });
    case 'bell': return new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 12, envelope: { attack: att, decay: 1.2, sustain: 0.05, release: len * 2 },
                                           modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0 } });
    case 'pluck': return new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: att, decay: 0.3, sustain: 0.05, release: len } });
    default: return new Tone.Synth({ oscillator: { type: 'pulse', width: 0.25 }, envelope: { attack: att, decay: 0.1, sustain: 0.5, release: len * 0.5 } });
  }
}
// one voice per call: synth -> filter (y) -> pan (x) -> its family's channel
function voice(i) {
  const c = tile.P.calls[i], f = family(c), key = S[f + 'Inst'] + '|' + S[f + 'Len'];
  let v = A.voices[i];
  if (v && v.key === key) return v;
  if (v) { v.synth.dispose(); v.filter.dispose(); v.pan.dispose(); }
  const pan = new Tone.Panner(0).connect(A.ch[f]);
  const filter = new Tone.Filter(4000, 'lowpass').connect(pan);
  const synth = makeSynth(S[f + 'Inst'], c.colour === 'cut', S[f + 'Len']).connect(filter);
  synth.volume.value = 0;
  return (A.voices[i] = { key, synth, filter, pan });
}
// a call's size (radius / longer side / height) and position, at given numbers
const arg = (i, j, over) => (over && over[`c${i}:${j}`] !== undefined ? over[`c${i}:${j}`] : tile.value(`c${i}:${j}`));
function sizeOf(i, over) {
  const c = tile.P.calls[i];
  return c.shape === 'circle' ? arg(i, 2, over) : c.shape === 'rect' ? Math.max(arg(i, 2, over), arg(i, 3, over)) : arg(i, 1, over);
}
const xOf = (i, over) => arg(i, 0, over);
const yOf = (i, over) => (tile.P.calls[i].shape === 'tri' ? 0 : arg(i, 1, over));
// size -> a note on the scale: bigger = lower (about a scale step per 20% of size)
function noteOf(i, size) {
  const c = tile.P.calls[i], f = family(c);
  const ref = { circle: 4, rect: 2, tri: 3 }[f], base = { circle: 60, rect: 72, tri: 72 }[f];
  const d = clamp(Math.round(-Math.log2(Math.max(size, 0.05) / ref) * 3), -6, 8) + (c.colour === 'cut' ? -5 : 0);
  return degree(d, base + S[f + 'Oct'] * 12);
}
const panOf = (x) => clamp(x / 16, -1, 1) * S.panWidth;   // never fully to one side: some setups are mono
const cutoffOf = (y) => clamp(600 + ((y + 16) / 32) * 7000, 300, 9000);

// play shape i now (+delay), or gliding from numbers `from` to `to` over `dur`
function playShape(i, at, glide) {
  const v = voice(i), f = family(tile.P.calls[i]), len = S[f + 'Len'];
  const from = glide ? glide.from : null, to = glide ? glide.to : null;
  const n0 = midiToHz(noteOf(i, sizeOf(i, from))), n1 = midiToHz(noteOf(i, sizeOf(i, to)));
  at = safe(v.synth, at);
  v.pan.pan.setValueAtTime(panOf(xOf(i, from)), at);
  v.filter.frequency.setValueAtTime(cutoffOf(yOf(i, from)), at);
  if (LOG) {   // testing: the loudest moment in the half second after it plays
    const line = `${tile.time.toFixed(2)} shape ${i} ${tile.P.calls[i].colour} ${f} ${n0.toFixed(0)}Hz pan ${panOf(xOf(i, from)).toFixed(2)}${glide ? ' glide' : ''}`;
    let peak = -Infinity, lr = [-Infinity, -Infinity], k = 0;
    const id = setInterval(() => { const v = [].concat(A.meter.getValue()); peak = Math.max(peak, ...v); lr = lr.map((x, c) => Math.max(x, v[c] ?? -Infinity)); if (++k === 12) { clearInterval(id); logEl.textContent += `${line} peak ${peak.toFixed(1)} dB (L ${lr[0].toFixed(1)}, R ${lr[1].toFixed(1)})\n`; } }, 40);
  }
  if (!glide) { v.synth.triggerAttackRelease(n0, len, at, 0.8); flash(f, at); return; }
  const dur = glide.dur, stretch = S[f + 'Follow'] === 'on';
  v.synth.triggerAttack(n0, at, 0.8);
  if (stretch) v.synth.frequency.exponentialRampToValueAtTime(n1, at + dur);
  v.pan.pan.linearRampToValueAtTime(panOf(xOf(i, to)), at + dur);
  v.filter.frequency.exponentialRampToValueAtTime(cutoffOf(yOf(i, to)), at + dur);
  v.synth.triggerRelease(at + dur);
  flash(f, at);
}

// ---------------------------------------------------------------- following the picture

const AHEAD = 0.12;                              // seconds of the clock scheduled ahead
let last = null;                                 // the animation's time at the previous frame
let schedIt = null;                              // the clock (iTime) scheduled up to
let seenTweens = new WeakSet();
let holding = false;                             // pad / bass sounding

function silence() {
  if (!A) return;
  A.pad.releaseAll(); A.bass.triggerRelease(); A.fxNoise.triggerRelease();
  holding = false;
}

function step() {
  requestAnimationFrame(step);
  if (!A || !tile.ready) return;
  const t = tile.time, now = Tone.now();
  const ctx = Tone.getContext();
  if (!tile.playing) {                           // paused: suspend the audio engine, so nothing rings on
    if (holding) silence();
    if (ctx.state === 'running') ctx.rawContext.suspend();
    schedIt = null; last = t; return;
  }
  if (ctx.state === 'suspended') { ctx.resume(); return; }   // play again
  if (t === last) { schedIt = null; return; }
  const jumped = last === null || t < last || t - last > 0.5;   // rewind, skip, ?t=
  if (jumped) { silence(); schedIt = null; tile.tweens.forEach((tw) => seenTweens.add(tw)); }

  // the build: shapes landing, the cut, the reflections, the glow, the drop
  const prev = last;
  last = t;                                      // recorded first, so a failing note isn't retried every frame
  if (!jumped) {
    let steps = 0;
    for (const seg of tile.timeline) {
      if (seg.kind === 'step') steps++;
      const at = seg.start + seg.typed;
      if (at <= prev || at > t) continue;
      try {
      if (seg.kind === 'step') playShape(steps - 1, now + 0.02);
      else if (seg.kind === 'cut') sweep(now, 0.4, 3000, 300);
      else if (seg.kind === 'fold') sweep(now, 0.6, 300, 6000);
      else if (seg.kind === 'melt') { kick(now + 0.02, 1); sweep(now, 1.2, 8000, 200); }
      } catch (e) { console.warn('sound:', e.message); }
    }
  }

  // the random changes: a shape's number gliding -> its voice gliding; the zoom -> a riser
  for (const tw of tile.tweens) {
    if (seenTweens.has(tw)) continue;
    seenTweens.add(tw);
    const m = tw.key.match(/^c(\d+):(\d+)$/);
    try {
      if (m) {}   // a shape's change is heard through the sequencer (its new note, accented)
      else if (tw.key === 'view:0') sweep(now, tw.dur, tw.to > tw.from ? 300 : 6000, tw.to > tw.from ? 6000 : 300);
    } catch (e) { console.warn('sound:', e.message); }
  }

  // the rhythm, from the clock (only once the melt has started it)
  const it = tile.iTime;
  if (it <= 0) return;
  if (schedIt === null) schedIt = it;
  const end = it + AHEAD, from = schedIt;
  schedIt = end;                                 // recorded first: a failing note can't make it retry forever
  const at = (x) => now + Math.max(0, x - it);
  try { rhythm(from, end, at); } catch (e) { console.warn('sound:', e.message); }
  holding = true;
  follow(it);
}

// one sequencer step: shape i at its current note; louder and longer while it is being changed
function seqStep(i, at) {
  const v = voice(i), f = family(tile.P.calls[i]);
  const lc = tile.time - tile.total;           // the live clock the changes run on
  const changing = S[f + 'Follow'] === 'on' && tile.tweens.some((tw) => tw.key.startsWith(`c${i}:`) && tw.start <= lc && lc < tw.start + tw.dur);
  at = safe(v.synth, at);
  v.pan.pan.setValueAtTime(panOf(xOf(i)), at);
  v.filter.frequency.setValueAtTime(cutoffOf(yOf(i)), at);
  v.synth.triggerAttackRelease(midiToHz(noteOf(i, sizeOf(i))), S[f + 'Len'] * (changing ? 2 : 1), at, changing ? 0.95 : 0.45);
  if (LOG) logEl.textContent += `${tile.time.toFixed(2)} step ${i} ${f} ${noteOf(i, sizeOf(i))}${changing ? ' ACCENT' : ''}\n`;
  flash(f, at);
}

// the beat between clock times `from` and `end` (bars, hats, blips)
function rhythm(schedIt, end, at) {
  const grid = BAR / 32;                          // 32nd notes
  for (let k = Math.floor(schedIt / grid) + 1; k * grid <= end; k++) {
    const g = k * grid, c = Math.floor(g / BAR), s = Math.round((g - c * BAR) / grid) % 32;
    if (s === 0) bar(c, at(g));
    // the sequencer: the shapes take turns, one per 16th note (18 shapes over 16-step bars, so it drifts)
    if (s % 2 === 0 && S.seq !== 'off' && tile.P.calls.length) {
      const i = Math.round(g / (grid * 2)) % tile.P.calls.length;
      seqStep(i, at(g));
    }
    if (s === 16) snare(at(g));
    if (S.kickPattern === 'four on floor' && s % 8 === 0) kick(at(g), 0.9);
    else if (S.kickPattern === 'blip + one' && s === 0) kick(at(g), 0.8);
    // hats: denser as the mosaic gets denser (tiles across 1..8), plus the density setting
    const level = clamp(Math.round((tile.tiles - 1) / 3.5) + S.hatDensity, 0, 3);
    const every = [8, 4, 2, 1][level];
    if (s % every === 0 && s !== 0) {
      const swing = (s / every) % 2 === 1 ? S.swing * every * grid * 0.5 : 0;
      A.hat.triggerAttackRelease('32n', safe(A.hat, at(g) + swing), 0.5 + 0.3 * Math.random());
      flash('hats', at(g) + swing);
    }
  }
  // the blips: one per bar, off the grid
  for (let c = Math.floor(schedIt / BAR); c <= Math.floor(end / BAR); c++) {
    const b = blipAt(c);
    if (b > schedIt && b <= end) kick(at(b), blipStrength(c) / 0.75);
  }
}

// continuous: the pad's filter breathes with the glow; the sway widens it and pans the hats
function follow(it) {
  const P = tile.P;
  if (P.glowAt) {
    const g = P.glowAt(P.glow, it), [lo, hi] = P.glowRange, crisp = clamp((g - lo) / (hi - lo), 0, 1);
    A.padFilter.frequency.rampTo(400 + 6000 * (1 - S.glowFollow + S.glowFollow * crisp), 0.05);
  }
  if (P.seamAt) {
    const s = P.seamAt(it), [lo, hi] = P.seamRange, sway = ((s - lo) / (hi - lo)) * 2 - 1;
    A.padWide.width.rampTo(0.3 + 0.6 * Math.abs(sway), 0.1);
    A.hatPan.pan.rampTo(0.6 * sway, 0.1);
  }
}

function kick(at, vel) {
  at = safe(A.kick, at);
  A.kick.triggerAttackRelease(midiToHz(S.kickPitch), 0.5, at, clamp(vel, 0.2, 1));
  const d = A.music.gain;                        // sidechain: everything else ducks under the kick
  d.cancelScheduledValues(at); d.setValueAtTime(1 - S.duck * 0.8, at); d.linearRampToValueAtTime(1, at + 0.22);
  flash('kick', at);
}
function snare(at) {
  if (S.snareType === 'glitch') A.glitch.triggerAttackRelease('16n', safe(A.glitch, at), 0.9);
  else {
    A.snareNoise.envelope.decay = S.snareType === 'clap' ? 0.12 : 0.2;
    A.snareNoise.triggerAttackRelease(0.15, safe(A.snareNoise, at), 0.9);
    if (S.snareType === 'snare') A.snareBody.triggerAttackRelease(180, 0.1, safe(A.snareBody, at), 0.7);
  }
  flash('snare', at);
}
// the bar line: the bass note and the pad chord on it, from the bar's golden-ratio r; the open hat
function bar(c, at) {
  const d = Math.floor(barR(c) * 7);
  A.bass.triggerAttackRelease(midiToHz(degree(d, 24 + 12 * S.bassOct)), BAR * 0.95, safe(A.bass, at), 0.9);
  A.pad.triggerAttackRelease([0, 2, 4].map((k) => midiToHz(degree(d + k, 60))), BAR * 0.98, safe(A.pad, at), 0.5);
  A.openHat.triggerAttackRelease('8n', safe(A.openHat, at), 0.6);
  flash('bass', at); flash('pad', at); flash('hats', at);
}
// a filtered-noise sweep (risers, downlifters, whooshes)
function sweep(at, dur, f0, f1) {
  at = safe(A.fxNoise, at);
  A.fxFilter.frequency.cancelScheduledValues(at);
  A.fxFilter.frequency.setValueAtTime(f0, at);
  A.fxFilter.frequency.exponentialRampToValueAtTime(f1, at + dur);
  A.fxNoise.triggerAttackRelease(dur, at, 0.7);
}

// ---------------------------------------------------------------- applying settings

function apply(id) {
  save();
  if (!A) return;
  const v = S[id];
  if (A.ch[id]) A.ch[id].volume.rampTo(v, 0.05);
  switch (id) {
    case 'volume': A.master.volume.rampTo(v, 0.05); break;
    case 'kickDecay': A.kick.envelope.decay = v; break;
    case 'kickDrive': A.kickDrive.distortion = v; break;
    case 'bassType': setBassType(); break;
    case 'bassGlide': A.bass.portamento = v; break;
    case 'bassDrive': A.bassDrive.distortion = v; break;
    case 'padType': case 'padDetune': setPad(); break;
    case 'reverbSize': A.reverb.decay = v; break;
    case 'reverbMix': A.reverb.wet.rampTo(v, 0.05); break;
    case 'delayTime': A.delay.delayTime.value = delayTime(); break;
    case 'delayFeedback': A.delay.feedback.rampTo(v, 0.05); break;
    case 'delayMix': A.delay.wet.rampTo(v, 0.05); break;
    case 'crushBits': A.crusher.bits.value = v; break;
    case 'crushMix': case 'chorusMix': rewire(); break;
    case 'lowCut': A.lowCut.frequency.rampTo(v, 0.05); break;
  }
}

// ---------------------------------------------------------------- the controls

const gui = document.getElementById('gui');
const names = {};                                // channel -> its row's name element (flashes)
const fmt = (p, v) => (p.note ? `${KEYS[v % 12]}${Math.floor(v / 12) - 1}` : p.unit === 'dB' ? `${v > 0 ? '+' : ''}${v} dB`
  : p.unit ? `${v}${p.unit}` : String(v));
function render() {
  gui.innerHTML = '';
  for (const p of PARAMS) {
    if (p.section) { gui.insertAdjacentHTML('beforeend', `<h3>// ${p.section}${p.section === 'master' ? '<span id="audiostate"></span>' : ''}</h3>`); continue; }
    const row = document.createElement('div');
    row.className = 'row' + (p.ch && muted.has(p.ch) ? ' muted' : '');
    const name = document.createElement('span');
    name.className = 'name'; name.textContent = p.label;
    if (p.ch) { names[p.ch] = name; name.title = 'click to mute'; name.onclick = () => toggleMute(p.ch, row); }
    const val = document.createElement('span'); val.className = 'val';
    let input;
    if (p.options) {
      input = document.createElement('select');
      input.innerHTML = p.options.map((o) => `<option${o === S[p.id] ? ' selected' : ''}>${o}</option>`).join('');
      input.onchange = () => { S[p.id] = input.value; apply(p.id); };
    } else {
      input = document.createElement('input');
      Object.assign(input, { type: 'range', min: p.min, max: p.max, step: p.step, value: S[p.id] });
      val.textContent = fmt(p, S[p.id]);
      input.oninput = () => { S[p.id] = +input.value; val.textContent = fmt(p, S[p.id]); apply(p.id); };
    }
    row.append(name, input, val);
    gui.append(row);
  }
  // presets: saved automatically; copy / paste as JSON; reset
  const box = document.createElement('div'); box.className = 'presets';
  const text = document.createElement('textarea');
  const button = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; box.append(b); };
  button('copy settings', () => { text.value = JSON.stringify(S, null, 1); text.style.display = 'block'; text.select(); navigator.clipboard?.writeText(text.value); });
  button('paste settings', () => {
    if (text.style.display !== 'block') { text.value = ''; text.style.display = 'block'; text.placeholder = 'paste settings here, then click again'; text.focus(); return; }
    try { S = { ...defaults, ...JSON.parse(text.value) }; text.style.display = 'none'; render(); Object.keys(S).forEach(apply); } catch (e) { text.placeholder = 'that is not valid JSON'; text.value = ''; }
  });
  button('reset', () => { S = { ...defaults }; muted = new Set(); render(); Object.keys(S).forEach(apply); if (A) Object.values(A.ch).forEach((c) => (c.mute = false)); });
  gui.insertAdjacentHTML('beforeend', '<h3>// presets</h3>');
  gui.append(box, text);
}
function toggleMute(id, row) {
  muted.has(id) ? muted.delete(id) : muted.add(id);
  row.classList.toggle('muted', muted.has(id));
  if (A && A.ch[id]) A.ch[id].mute = muted.has(id);
  save();
}
// a row's name flashes pink when its sound plays (at the moment it is heard)
const LOG = new URLSearchParams(location.search).has('log');   // testing: a log of what plays, in the page
const logEl = LOG ? document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'soundlog' })) : null;
function flash(id, at) {
  if (LOG) logEl.textContent += `${tile.time.toFixed(2)} ${id} it=${tile.iTime.toFixed(2)}\n`;
  const el = names[id];
  if (!el) return;
  (Tone.getDraw ? Tone.getDraw() : Tone.Draw).schedule(() => { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 90); }, at);
}

// the audio engine's state next to "// master": running / suspended / closed (or not started)
setInterval(() => {
  const el = document.getElementById('audiostate');
  if (el) el.textContent = ' · audio ' + (A ? `${Tone.getContext().state} · ${Math.round((Tone.getContext().rawContext.baseLatency || 0) * 1000)} ms buffer` : 'not started');
}, 500);

// ---------------------------------------------------------------- start

render();
const startEl = document.getElementById('start');
tile.setPlaying(false);                          // wait for the click: audio can't start without one
async function begin() {
  // a bigger audio buffer than Tone's default ("interactive"): everything is scheduled ahead, so the
  // extra latency doesn't matter, and it keeps playback from crackling when the computer is busy
  Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.15 }));
  await Tone.start();
  build();
  if (typeof record === 'function') record();
  startEl.classList.add('gone');
  tile.setPlaying(true);
}
startEl.onclick = begin;
// browsers can suspend audio (an output device changing, the tab in the background): any click or
// key on the page wakes it again
const wake = () => { if (A && tile.playing && Tone.getContext().state !== 'running') Tone.start(); };
addEventListener('pointerdown', wake);
addEventListener('keydown', wake);
document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
// testing: ?autostart skips the click (browsers only allow it with autoplay permitted)
if (new URLSearchParams(location.search).has('autostart')) begin();
const logTo = new URLSearchParams(location.search).get('logto');   // testing: send the log to a local receiver
if (LOG && logTo) setInterval(() => navigator.sendBeacon(logTo, logEl.textContent), 2000);
// testing: ?stats logs, each second, the output's peak, clipped samples, and roughness
// (sample-to-sample jumps relative to the level: crackle and quantisation noise raise it)
function record() {
  if (!LOG || !new URLSearchParams(location.search).has('stats')) return;
  try {
    const wf = new Tone.Waveform(8192); A.master.connect(wf);
    let acc = { peak: 0, clip: 0, d2: 0, s2: 0 }, ticks = 0;
    setInterval(() => {
      const x = wf.getValue();
      for (let k = 1; k < x.length; k++) {
        const a = Math.abs(x[k]); acc.peak = Math.max(acc.peak, a); if (a > 0.98) acc.clip++;
        acc.s2 += x[k] * x[k]; acc.d2 += (x[k] - x[k - 1]) ** 2;
      }
      if (++ticks % 10 === 0) {
        const db = (v) => (20 * Math.log10(v + 1e-9)).toFixed(1);
        logEl.textContent += `${tile.time.toFixed(1)} stats peak ${db(acc.peak)} dB clip ${acc.clip} rough ${(Math.sqrt(acc.d2 / (acc.s2 + 1e-12))).toFixed(3)}\n`;
        acc = { peak: 0, clip: 0, d2: 0, s2: 0 };
      }
    }, 100);
  } catch (e) { logEl.textContent += 'stats failed: ' + e.message + '\n'; }
}
// testing: ?rewindAt=8 presses rewind once the animation passes 8 s
const rewindAt = +new URLSearchParams(location.search).get('rewindAt');
if (rewindAt) { let done = false; setInterval(() => { if (!done && tile.time > rewindAt) { done = true; if (LOG) logEl.textContent += 'REWIND\n'; document.getElementById('rewind').click(); } }, 50); }
// testing: ?skipAt=2 presses the skip button once the animation passes 2 s
const skipAt = +new URLSearchParams(location.search).get('skipAt');
if (skipAt) { let done = false; setInterval(() => { if (!done && tile.time > skipAt) { done = true; if (LOG) logEl.textContent += 'SKIP\n'; document.getElementById('skip').click(); } }, 50); }
// testing: ?pauseAt=70 presses pause once the animation passes 70 s, then logs the audio state
const pauseAt = +new URLSearchParams(location.search).get('pauseAt');
if (pauseAt) { let done = false; setInterval(() => {
  if (!done && tile.time > pauseAt) { done = true; document.getElementById('play').click(); }
  if (done && LOG) logEl.textContent += `PAUSED · audio ${Tone.getContext().state}\n`; }, 500); }
// testing: ?clickName=rects clicks a row's name (mutes it), as a person would
const clickName = new URLSearchParams(location.search).get('clickName');
if (clickName) [...gui.querySelectorAll('.name')].find((e) => e.textContent.trim() === clickName)?.click();
// testing: ?set=crushMix:0,reverbMix:0.1 overrides settings (not saved)
for (const kv of (new URLSearchParams(location.search).get('set') || '').split(',').filter(Boolean)) {
  const [k, v] = kv.split(':'); S[k] = isNaN(+v) ? v : +v;
}
requestAnimationFrame(step);
})();
