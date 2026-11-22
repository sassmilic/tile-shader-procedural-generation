// The sound page: the mosaic plays hyperpop.
//
// Audio and the mosaic share the playback clock. The audio timer schedules notes ahead,
// and reads the mosaic's score data for instrument parameters:
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
  // Minimal isolates the dry drums while keeping the shared master controls.
  { id: 'engine', label: 'engine', options: ['full', 'minimal'], def: 'full' },
  { id: 'volume', label: 'volume', min: -40, max: 0, step: 1, def: -10, unit: 'dB' },
  { id: 'lowCut', label: 'low cut', min: 20, max: 200, step: 5, def: 70, unit: ' Hz' },   // small speakers can't do deep bass
  { id: 'key', label: 'key', options: KEYS, def: 'A' },
  { id: 'scale', label: 'scale', options: Object.keys(SCALES), def: 'pentatonic' },
  { section: 'drums' },
  { id: 'kick', label: 'kick', min: -40, max: 6, step: 1, def: 0, unit: 'dB', ch: 'kick' },
  { id: 'kickPattern', label: '  pattern', options: ['blip', 'blip + one', 'four on floor'], def: 'blip' },
  { id: 'kickSound', label: '  sound', options: ['808', 'synth'], def: '808' },
  { id: 'kickPitch', label: '  tune', min: 20, max: 48, step: 1, def: 40, note: true },   // E2: above the low cut
  { id: 'kickDecay', label: '  decay', min: 0.1, max: 2.5, step: 0.05, def: 0.6 },   // an 808's boom: try 1-2 s
  { id: 'kickPunch', label: '  punch', min: 0.5, max: 6, step: 0.25, def: 2.5 },   // octaves the pitch falls through at the start
  { id: 'kickDrive', label: '  drive', min: 0, max: 1, step: 0.05, def: 0.15 },
  { id: 'snare', label: 'snare', min: -40, max: 6, step: 1, def: 2, unit: 'dB', ch: 'snare' },
  { id: 'snareSound', label: '  sound', options: ['808 clap', '808 snare', 'clap', 'snare', 'glitch'], def: '808 clap' },
  { id: 'snareTone', label: '  tone', min: 120, max: 320, step: 5, def: 185, unit: ' Hz' },   // 808 snare: its body's pitch
  { id: 'snappy', label: '  snappy', min: 0, max: 1, step: 0.05, def: 0.6 },   // 808 snare: how much noise
  { id: 'snareDecay', label: '  decay', min: 0.05, max: 0.6, step: 0.01, def: 0.2, unit: 's' },
  { id: 'clapSpread', label: '  clap spread', min: 0.004, max: 0.03, step: 0.001, def: 0.011, unit: 's' },   // 808 clap: gap between its bursts
  { id: 'hats', label: 'hats', min: -40, max: 6, step: 1, def: -4, unit: 'dB', ch: 'hats' },
  { id: 'hatSound', label: '  sound', options: ['808', 'noise'], def: '808' },
  { id: 'hatTone', label: '  tone', min: 4000, max: 10000, step: 100, def: 7500, unit: ' Hz' },
  { id: 'hatDecay', label: '  closed', min: 0.02, max: 0.2, step: 0.005, def: 0.05, unit: 's' },
  { id: 'openDecay', label: '  open', min: 0.1, max: 1, step: 0.05, def: 0.35, unit: 's' },
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
  { id: 'fx', label: 'sweeps', min: -40, max: 6, step: 1, def: -10, unit: 'dB', ch: 'fx' },   // whooshes and risers
];
const STORE = 'block-pattern-sound:v7';
const PREVIOUS_STORE = 'block-pattern-sound:v6';
const controls = PARAMS.filter((p) => p.id);
const channels = controls.filter((p) => p.ch).map((p) => p.ch);
// Circles and sweeps make the build audible before the drums enter.
const DEFAULT_MUTED = ['rect', 'tri', 'bass', 'pad'];

function settingsFrom(settings) {
  return Object.fromEntries(controls.map((p) => {
    const value = settings?.[p.id];
    if (p.options) return [p.id, p.options.includes(value) ? value : p.def];
    if (!Number.isFinite(value)) return [p.id, p.def];
    const bounded = Math.min(p.max, Math.max(p.min, value));
    const steps = Math.round((bounded - p.min) / p.step);
    return [p.id, Number((p.min + steps * p.step).toFixed(6))];
  }));
}

function mutesFrom(value) {
  return Array.isArray(value) ? value.filter((id) => channels.includes(id)) : null;
}

function readSetting(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch { return null; }
}

// Testing overrides follow the same validation as saved presets.
const overrides = Object.fromEntries(
  (new URLSearchParams(location.search).get('set') || '').split(',').filter(Boolean).map((pair) => {
    const [key, value] = pair.split(':');
    return [key, value?.trim() && Number.isFinite(Number(value)) ? Number(value) : value];
  }),
);
let S = settingsFrom({ ...(readSetting(STORE) ?? readSetting(PREVIOUS_STORE)), ...overrides });
let muted = new Set(mutesFrom(readSetting(STORE + ':muted')) ?? mutesFrom(readSetting(PREVIOUS_STORE + ':muted')) ?? DEFAULT_MUTED);
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(S));
    localStorage.setItem(STORE + ':muted', JSON.stringify([...muted]));
  } catch {
    // Settings still work for this page if the browser blocks storage.
  }
}

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
const diagnostics = new URLSearchParams(location.search).has('diagnostics');
function build() {
  const full = S.engine === 'full';
  const output = new Tone.Gain(0.8).toDestination();
  const limiter = new Tone.Limiter(-3).connect(output);
  const highCut = new Tone.Filter(14000, 'lowpass', -12).connect(limiter);
  const lowCut = new Tone.Filter(S.lowCut, 'highpass', -24).connect(highCut);
  const master = new Tone.Volume(S.volume).connect(lowCut);
  const fxReturn = new Tone.Gain(full ? 1 : 0).connect(master);
  const reverb = new Tone.Reverb({ decay: S.reverbSize, wet: S.reverbMix }).connect(fxReturn);
  const delay = new Tone.FeedbackDelay({ delayTime: delayTime(), feedback: S.delayFeedback, wet: S.delayMix }).connect(reverb);
  const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.6, wet: S.chorusMix }).connect(delay);
  const crusher = new Tone.BitCrusher({ bits: S.crushBits, wet: S.crushMix }).connect(chorus);
  const musicInput = new Tone.Gain(full ? 1 : 0).connect(crusher);
  const music = new Tone.Gain(1).connect(musicInput);   // ducked by the kick
  const drums = new Tone.Gain(1).connect(master);
  const drumVerb = new Tone.Gain(full ? 0.15 : 0).connect(reverb);
  drums.connect(drumVerb);

  const ch = {}, muteGain = {};
  function channel(id, dest) {
    muteGain[id] = new Tone.Gain(muted.has(id) ? 0 : 1).connect(dest);
    ch[id] = new Tone.Volume(S[id]).connect(muteGain[id]);
  }
  ['kick', 'snare', 'hats'].forEach((id) => channel(id, drums));
  ['bass', 'pad', 'circle', 'rect', 'tri', 'fx'].forEach((id) => channel(id, music));

  // drums
  const distortion = (amount) => new Tone.Distortion({ distortion: amount, wet: amount === 0 ? 0 : 1, oversample: '2x' });
  const kickDrive = distortion(S.kickDrive).connect(ch.kick);
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: S.kickDecay, sustain: 0, release: 0.1 } }).connect(kickDrive);
  // 808 kit. Kick: a sine whose pitch falls `punch` octaves into the note, then a long boom.
  const kick808 = new Tone.MembraneSynth({ oscillator: { type: 'sine' }, pitchDecay: 0.06, octaves: S.kickPunch,
                                           envelope: { attack: 0.001, decay: S.kickDecay, sustain: 0, release: 0.15 } }).connect(kickDrive);
  // Snare: two tuned bodies (about 1 : 1.8, like the 808's) and noise through a highpass ("snappy").
  const snare808Body = [1, 1.8].map(() => new Tone.MembraneSynth({ oscillator: { type: 'sine' }, pitchDecay: 0.01, octaves: 0.3,
                                                                    envelope: { attack: 0.001, decay: S.snareDecay * 0.7, sustain: 0, release: 0.05 } }).connect(ch.snare));
  const snappyGain = new Tone.Gain(S.snappy).connect(ch.snare);
  const snappyTop = new Tone.Filter(9000, 'lowpass').connect(snappyGain);   // no fizz above what speakers play
  const snappyFilter = new Tone.Filter(1800, 'highpass').connect(snappyTop);
  const snareNoise808 = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: S.snareDecay, sustain: 0 } }).connect(snappyFilter);
  snareNoise808.volume.value = -12;
  snare808Body.forEach((b) => (b.volume.value = -10));
  // Clap: a few quick noise bursts and a tail, through a band around 1.1 kHz.
  const clapBand = new Tone.Filter({ frequency: 1100, type: 'bandpass', Q: 1.6 }).connect(ch.snare);
  const clapBurst = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.012, sustain: 0 } }).connect(clapBand);
  const clapTail = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: S.snareDecay, sustain: 0 } }).connect(clapBand);
  const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { decay: 0.12, sustain: 0 } }).connect(ch.snare);
  const snareFilter = new Tone.Filter(1800, 'bandpass').connect(ch.snare);
  const snareNoise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }).connect(snareFilter);
  const glitch = new Tone.MetalSynth({ envelope: { decay: 0.08, release: 0.02 }, harmonicity: 8.1, modulationIndex: 40, resonance: 3000 }).connect(ch.snare);
  glitch.volume.value = -12;
  // Hats use band-limited noise to keep the transients around 8 kHz.
  const hatPan = new Tone.Panner(0).connect(ch.hats);
  const hatBand = new Tone.Filter({ frequency: 8000, type: 'bandpass', Q: 0.9 }).connect(hatPan);
  const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.01 } }).connect(hatBand);
  hat.volume.value = -6;
  const openHat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.08 } }).connect(hatBand);
  openHat.volume.value = -12;
  // 808 hats: six square waves at the 808's clashing pitches, band-passed (kept around 7.5 kHz, below
  // the range small speakers can't play), through a short (closed) or longer (open) envelope.
  const hatMix = new Tone.Gain(0.16);
  const hatOsc = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => new Tone.Oscillator(f, 'square').connect(hatMix));
  const hat808Band = new Tone.Filter({ frequency: S.hatTone, type: 'bandpass', Q: 1.2 });
  const hat808High = new Tone.Filter(5000, 'highpass');
  hatMix.connect(hat808Band); hat808Band.connect(hat808High);
  const hat808 = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: S.hatDecay, sustain: 0, release: 0.01 }).connect(hatPan);
  const openHat808 = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: S.openDecay, sustain: 0, release: 0.05 }).connect(hatPan);
  hat808High.connect(hat808); hat808High.connect(openHat808);
  openHat808.output.gain.value = 0.6;

  // bass and pad
  const bassDrive = distortion(S.bassDrive).connect(ch.bass);
  const bass = new Tone.MonoSynth({ portamento: S.bassGlide, envelope: { attack: 0.005, decay: 0.3, sustain: 0.8, release: 0.2 },
                                    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.6, baseFrequency: 120, octaves: 3 } }).connect(bassDrive);
  const padWide = new Tone.StereoWidener(0.5).connect(ch.pad);
  const padFilter = new Tone.Filter(1500, 'lowpass', -24).connect(padWide);
  const fxNoise = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.5, decay: 0.1, sustain: 1, release: 0.3 } });
  const fxFilter = new Tone.Filter(400, 'bandpass', -12).connect(ch.fx); fxNoise.connect(fxFilter);

  const meter = new Tone.Meter({ smoothing: 0, channelCount: 2 });
  output.connect(meter);
  const probeNodes = [['output', output]];
  if (diagnostics) probeNodes.push(['drums', drums], ['kick', muteGain.kick], ['snare', muteGain.snare],
    ['hats', muteGain.hats], ['filtered', highCut], ['limiter', limiter]);
  const probes = probeNodes.map(([name, node]) => {
    const waveform = new Tone.Analyser({ type: 'waveform', channels: 2, size: 8192 });
    node.connect(waveform);
    return { name, waveform };
  });
  const nodes = [fxNoise, bass, kick, snareBody, snareNoise, glitch, hat, openHat, fxFilter, bassDrive, kickDrive,
    kick808, ...snare808Body, snappyGain, snappyFilter, snappyTop, snareNoise808, clapBand, clapBurst, clapTail,
    ...hatOsc, hatMix, hat808Band, hat808High, hat808, openHat808,
    snareFilter, hatBand, hatPan, padFilter, padWide, ...Object.values(ch), ...Object.values(muteGain),
    music, musicInput, drums, drumVerb, crusher, chorus, delay, reverb, fxReturn, master, lowCut, highCut, limiter,
    meter, ...probes.map(({waveform}) => waveform), output];
  A = { nodes, probes, drums, drumVerb, musicInput, fxReturn, output, lowCut, meter, master, reverb, delay, chorus, crusher,
    music, ch, muteGain, kick, kickDrive, snareBody, snareNoise, glitch, hat, hatPan, openHat, bass, bassDrive,
    kick808, snare808Body, snappyGain, snareNoise808, clapBurst, clapTail, hatOsc, hat808Band, hat808, openHat808,
    padFilter, padWide, fxNoise, fxFilter, pad: null, voices: [] };
  setBassType();
  setPad();
}

function startEffects() {
  if (A.chorusStarted) return;
  A.hatOsc.forEach((o) => o.start());
  A.chorus.start();
  A.chorusStarted = true;
}

function disposeGraph() {
  if (!A) return;
  const graph = A;
  A = null;
  const voices = graph.voices.flatMap(({ synth, filter, pan }) => [synth, filter, pan]);
  const fft = ['kick', 'snare', 'hats'].map((id) => graph['fft_' + id]);
  const nodes = [graph.pad, graph.testTone, graph.statsWave, ...voices, ...fft, ...graph.nodes];
  nodes.forEach((node) => node?.dispose());
}
const delayTime = () => ({ '1/16': '16n', '1/8': '8n', '1/8 dotted': '8n.', '1/4': '4n' })[S.delayTime];
function setBassType() {
  A.bass.oscillator.type = { '808': 'sine', reese: 'fatsawtooth', square: 'square' }[S.bassType];
  if (S.bassType === 'reese') { A.bass.oscillator.count = 2; A.bass.oscillator.spread = 25; }
  A.bass.filter.frequency.value = S.bassType === '808' ? 2000 : 900;
}
function setPad() {
  if (A.padType === S.padType) return;
  if (A.pad) { A.pad.releaseAll(); A.pad.dispose(); }
  const t = S.padType;
  A.pad = t === 'fm choir'
    ? new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2, modulationIndex: 3, envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 1.2 } })
    : new Tone.PolySynth(Tone.Synth, { oscillator: t === 'organ' ? { type: 'fatsine', count: 2, spread: S.padDetune } : { type: 'fatsawtooth', count: 2, spread: S.padDetune },
                                       envelope: { attack: 0.25, decay: 0.3, sustain: 0.7, release: 1.2 } });
  A.pad.maxPolyphony = 12;
  A.pad.connect(A.padFilter);
  A.padType = t;
}

// Tone won't start an instrument at or before its previous start ("Start time must be strictly
// greater than previous start time"), which happens when two things land together (the drop's
// kick and the first beat, two changes to one shape). So every start goes through this.
const lastStart = new WeakMap();
let hits = 0, lastError = '';                    // shown in the status line next to "// master"
const report = (e) => { lastError = String(e && e.message || e).slice(0, 80); console.warn('sound:', lastError); };
addEventListener('error', (e) => report(e.error || e.message));
addEventListener('unhandledrejection', (e) => report(e.reason));
function safe(inst, at) {
  const t = Math.max(at, (lastStart.get(inst) ?? 0) + 0.003, Tone.immediate() + 0.005);
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

// ---------------------------------------------------------------- scheduling from the shared clock

const playback = window.playback;
const AHEAD = 0.25;
const LATE_LIMIT = 0.06;
let audioContext = null;
let scheduledUntil = null;
let seenTweens = new WeakSet();

function playEvent(run, at) {
  try { run(at); } catch (err) { report(err); }
}

function scheduleAudio() {
  if (!A || !tile.ready || !playback.playing || audioContext.state !== 'running') return;
  startEffects();
  const position = playback.time;
  const from = Math.max(scheduledUntil ?? position, position - LATE_LIMIT);
  const end = position + AHEAD;
  if (from >= end) return;
  scheduledUntil = end;

  // Refresh the score's geometry and zoom without waiting for the mosaic to render.
  tile.sample(position);
  const events = [];
  const collect = (time, run) => events.push({ time, run });
  let shapes = 0;
  for (const seg of tile.timeline) {
    if (seg.kind === 'step') shapes++;
    const time = seg.start + seg.typed;
    if (time < from || time >= end) continue;
    if (seg.kind === 'step') {
      const index = shapes - 1;
      collect(time, (at) => playShape(index, at));
    } else if (seg.kind === 'cut') collect(time, (at) => sweep(at, 0.4, 3000, 300));
    else if (seg.kind === 'fold') collect(time, (at) => sweep(at, 0.6, 300, 6000));
    else if (seg.kind === 'melt') {
      collect(time, (at) => kick(at, 1));
      collect(time, (at) => sweep(at, 1.2, 8000, 200));
    }
  }

  for (const tw of tile.tweens) {
    if (tw.key !== 'view:0' || seenTweens.has(tw)) continue;
    seenTweens.add(tw);
    const start = tile.total + tw.start;
    if (start < position - LATE_LIMIT) continue;
    const up = tw.to > tw.from;
    collect(start, (at) => sweep(at, tw.dur, up ? 300 : 6000, up ? 6000 : 300));
  }

  const drop = tile.dropTime;
  if (end > drop) {
    rhythm(from - drop, end - drop, (time, run) => collect(drop + time, run));
  }
  events.sort((a, b) => a.time - b.time);
  for (const { time, run } of events) {
    playEvent(run, Math.max(playback.sourceTimeAt(time), Tone.immediate() + 0.005));
  }
  if (position >= drop && S.engine !== 'minimal') playEvent(follow, position - drop);
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

// Collect events in [from, end) in seconds since the drop.
function rhythm(from, end, collect) {
  const grid = BAR / 32;
  const level = clamp(Math.round((tile.tiles - 1) / 3.5) + S.hatDensity, 0, 3);
  const every = [8, 4, 2, 1][level];
  for (let k = Math.ceil(Math.max(0, from) / grid); k * grid < end; k++) {
    const g = k * grid, c = Math.floor(k / 32), step = k % 32;
    if (step === 0) collect(g, (at) => bar(c, at));
    if (step % 2 === 0 && S.seq !== 'off' && tile.P.calls.length) {
      const i = (k / 2) % tile.P.calls.length;
      collect(g, (at) => seqStep(i, at));
    }
    if (step === 16) collect(g, snare);
    // The build's drop already queues its own kick at time zero.
    if (k > 0 && S.kickPattern === 'four on floor' && step % 8 === 0) {
      collect(g, (at) => kick(at, 0.9));
    } else if (k > 0 && S.kickPattern === 'blip + one' && step === 0) {
      collect(g, (at) => kick(at, 0.8));
    }
    if (step % every === 0 && step !== 0) {
      const swing = (step / every) % 2 === 1 ? S.swing * every * grid * 0.5 : 0;
      collect(g + swing, (at) => {
        const h = S.hatSound === '808' ? A.hat808 : A.hat;
        h.triggerAttackRelease('32n', safe(h, at), 0.5 + 0.3 * Math.random());
        flash('hats', at);
      });
    }
  }
  for (let c = Math.floor(Math.max(0, from) / BAR); c <= Math.floor(end / BAR); c++) {
    const time = blipAt(c);
    if (time >= from && time < end) collect(time, (at) => kick(at, blipStrength(c) / 0.75));
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
  const k = S.kickSound === '808' ? A.kick808 : A.kick;
  at = safe(k, at);
  k.triggerAttackRelease(midiToHz(S.kickPitch), 0.5, at, clamp(vel, 0.2, 1));
  if (!muted.has('kick') && S.duck > 0) {
    const gain = A.music.gain;
    gain.cancelAndHoldAtTime(at);
    gain.linearRampToValueAtTime(1 - S.duck * 0.8, at + 0.004);
    gain.linearRampToValueAtTime(1, at + 0.22);
  }
  flash('kick', at);
}
function snare(at) {
  if (S.snareSound === '808 snare') {
    A.snare808Body.forEach((b, i) => b.triggerAttackRelease(S.snareTone * [1, 1.8][i], 0.1, safe(b, at), 0.7));
    A.snareNoise808.triggerAttackRelease(S.snareDecay, safe(A.snareNoise808, at), 0.9);
  } else if (S.snareSound === '808 clap') {
    for (let k = 0; k < 3; k++) A.clapBurst.triggerAttackRelease(0.01, safe(A.clapBurst, at + k * S.clapSpread), 0.8);
    A.clapTail.triggerAttackRelease(S.snareDecay, safe(A.clapTail, at + 3 * S.clapSpread), 0.9);
  } else if (S.snareSound === 'glitch') A.glitch.triggerAttackRelease(400, '16n', safe(A.glitch, at), 0.9);
  else {
    A.snareNoise.envelope.decay = S.snareSound === 'clap' ? 0.12 : 0.2;
    A.snareNoise.triggerAttackRelease(0.15, safe(A.snareNoise, at), 0.9);
    if (S.snareSound === 'snare') A.snareBody.triggerAttackRelease(180, 0.1, safe(A.snareBody, at), 0.7);
  }
  flash('snare', at);
}
// the bar line: the bass note and the pad chord on it, from the bar's golden-ratio r; the open hat
function bar(c, at) {
  const d = Math.floor(barR(c) * 7);
  playEvent(() => {
    A.bass.triggerAttackRelease(midiToHz(degree(d, 24 + 12 * S.bassOct)), BAR * 0.95, safe(A.bass, at), 0.9);
    flash('bass', at);
  });
  playEvent(() => {
    A.pad.triggerAttackRelease([0, 2, 4].map((k) => midiToHz(degree(d + k, 60))), BAR * 0.98, safe(A.pad, at), 0.5);
    flash('pad', at);
  });
  const oh = S.hatSound === '808' ? A.openHat808 : A.openHat;
  oh.triggerAttackRelease('8n', safe(oh, at), 0.6);
  flash('hats', at);
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
  if (!A) return;
  const v = S[id];
  if (A.ch[id]) A.ch[id].volume.rampTo(v, 0.05);
  switch (id) {
    case 'volume': A.master.volume.rampTo(v, 0.05); break;
    case 'engine': {
      const full = v === 'full' ? 1 : 0;
      A.musicInput.gain.rampTo(full, 0.05);
      A.fxReturn.gain.rampTo(full, 0.05);
      A.drumVerb.gain.rampTo(full * 0.15, 0.05);
      break;
    }
    case 'kickDecay': A.kick.envelope.decay = v; A.kick808.envelope.decay = v; break;
    case 'kickPunch': A.kick808.octaves = v; break;
    case 'snareDecay':
      A.snareNoise808.envelope.decay = v; A.clapTail.envelope.decay = v;
      A.snare808Body.forEach((b) => (b.envelope.decay = v * 0.7));
      break;
    case 'snappy': A.snappyGain.gain.rampTo(v, 0.05); break;
    case 'hatTone': A.hat808Band.frequency.rampTo(v, 0.05); break;
    case 'hatDecay': A.hat808.decay = v; break;
    case 'openDecay': A.openHat808.decay = v; break;
    case 'kickDrive': setDrive(A.kickDrive, v); break;
    case 'bassType': setBassType(); break;
    case 'bassGlide': A.bass.portamento = v; break;
    case 'bassDrive': setDrive(A.bassDrive, v); break;
    case 'padType': setPad(); break;
    case 'padDetune':
      if (S.padType !== 'fm choir') A.pad.set({ oscillator: { spread: v } });
      break;
    case 'reverbSize': A.reverb.decay = v; break;
    case 'reverbMix': A.reverb.wet.rampTo(v, 0.05); break;
    case 'delayTime': A.delay.delayTime.value = delayTime(); break;
    case 'delayFeedback': A.delay.feedback.rampTo(v, 0.05); break;
    case 'delayMix': A.delay.wet.rampTo(v, 0.05); break;
    case 'crushBits': A.crusher.bits.value = v; break;
    case 'crushMix': A.crusher.wet.rampTo(v, 0.05); break;
    case 'chorusMix': A.chorus.wet.rampTo(v, 0.05); break;
    case 'lowCut': A.lowCut.frequency.rampTo(v, 0.05); break;
  }
}

function setDrive(effect, amount) {
  effect.distortion = amount;
  effect.wet.rampTo(amount === 0 ? 0 : 1, 0.05);
}

function applySettings(settings, nextMuted) {
  S = settings;
  muted = nextMuted;
  for (const id of channels) applyMute(id);
  for (const { id } of controls) apply(id);
  save();
  render();
}

function setSetting(id, value) {
  S[id] = value;
  apply(id);
  save();
}

function applyMute(id) {
  A?.muteGain[id].gain.rampTo(muted.has(id) ? 0 : 1, 0.05);
}

// ---------------------------------------------------------------- the controls

const gui = document.getElementById('gui');
const names = {};                                // channel -> its row's name element (flashes)
const fmt = (p, v) => (p.note ? `${KEYS[v % 12]}${Math.floor(v / 12) - 1}` : p.unit === 'dB' ? `${v > 0 ? '+' : ''}${v} dB`
  : p.unit ? `${v}${p.unit}` : String(v));

let speakerTest = null;
async function testDirect(frequency, duration) {
  if (speakerTest) return 'A speaker test is already playing.';
  const context = new AudioContext();
  speakerTest = context;
  const finish = () => {
    speakerTest = null;
    context.close().catch(report);
  };
  try {
    await context.resume();
    const tone = context.createOscillator();
    const gain = context.createGain();
    const at = context.currentTime;
    tone.frequency.value = frequency;
    tone.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.2, at + 0.02);
    gain.gain.setValueAtTime(0.2, at + duration - 0.04);
    gain.gain.linearRampToValueAtTime(0, at + duration);
    tone.onended = finish;
    tone.start(at);
    tone.stop(at + duration);
    return 'Speaker test playing.';
  } catch (error) {
    finish();
    throw error;
  }
}

function testThroughMix() {
  if (!A || !playback.playing || Tone.getContext().state !== 'running') return 'Play the animation to test the mix.';
  if (A.testTone) return 'A mix test is already playing.';
  const graph = A;
  const tone = new Tone.Oscillator({ frequency: 440, type: 'sine', volume: -16, onstop: () => {
    graph.testTone = null;
    tone.dispose();
  } }).connect(graph.drums);
  graph.testTone = tone;
  tone.start();
  tone.stop('+0.6');
  return 'Mix test playing.';
}

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
      input.onchange = () => setSetting(p.id, input.value);
    } else {
      input = document.createElement('input');
      Object.assign(input, { type: 'range', min: p.min, max: p.max, step: p.step, value: S[p.id] });
      val.textContent = fmt(p, S[p.id]);
      input.oninput = () => {
        val.textContent = fmt(p, +input.value);
        if (p.id !== 'reverbSize') setSetting(p.id, +input.value);
      };
      if (p.id === 'reverbSize') input.onchange = () => setSetting(p.id, +input.value);
    }
    row.append(name, input, val);
    gui.append(row);
  }
  // Direct tones use their own context so they can run while the transport is paused.
  const tests = document.createElement('div'); tests.className = 'presets';
  const testStatus = document.createElement('div'); testStatus.setAttribute('role', 'status');
  const tbtn = (label, run) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.onclick = async () => {
      try { testStatus.textContent = await run(); }
      catch (error) { testStatus.textContent = error.message; report(error); }
    };
    tests.append(button);
  };
  tbtn('test tone: direct', () => testDirect(440, 0.6));
  tbtn('test: 10 s tone', () => testDirect(330, 10));
  tbtn('test tone: through the mix', testThroughMix);
  const th = document.createElement('h3'); th.textContent = '// test your speakers';
  gui.prepend(th, tests, testStatus);

  // presets: saved automatically; copy / paste as JSON; reset
  const box = document.createElement('div'); box.className = 'presets';
  const text = document.createElement('textarea');
  const button = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; box.append(b); };
  button('copy settings', () => {
    text.value = JSON.stringify({ ...S, muted: [...muted] }, null, 1);
    text.style.display = 'block';
    text.select();
    navigator.clipboard?.writeText(text.value).catch(() => {});
  });
  button('paste settings', () => {
    if (text.style.display !== 'block') { text.value = ''; text.style.display = 'block'; text.placeholder = 'paste settings here, then click again'; text.focus(); return; }
    try {
      const settings = JSON.parse(text.value);
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new TypeError('Settings must be a JSON object.');
      const importedMutes = mutesFrom(settings.muted);
      applySettings(settingsFrom(settings), importedMutes ? new Set(importedMutes) : muted);
    } catch {
      text.placeholder = 'Paste a valid JSON settings object.';
      text.value = '';
    }
  });
  button('reset', () => applySettings(settingsFrom(), new Set(DEFAULT_MUTED)));
  gui.insertAdjacentHTML('beforeend', '<h3>// presets</h3>');
  gui.append(box, text);
}
function toggleMute(id, row) {
  muted.has(id) ? muted.delete(id) : muted.add(id);
  row.classList.toggle('muted', muted.has(id));
  applyMute(id);
  save();
}
// a row's name flashes pink when its sound plays (at the moment it is heard)
const LOG = new URLSearchParams(location.search).has('log');   // testing: a log of what plays, in the page
const logEl = LOG ? document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'soundlog' })) : null;
function flash(id, at) {
  if (id === 'kick' || id === 'snare' || id === 'hats') hits++;
  if (LOG) logEl.textContent += `${tile.time.toFixed(2)} ${id} it=${tile.iTime.toFixed(2)}\n`;
  const el = names[id];
  if (!el) return;
  (Tone.getDraw ? Tone.getDraw() : Tone.Draw).schedule(() => { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 90); }, at);
}

function probeLevel(waveform) {
  let peak = 0;
  for (const channel of waveform.getValue()) {
    for (const sample of channel) {
      if (!Number.isFinite(sample)) return 'invalid signal';
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  return peak === 0 ? '−∞ dBFS' : `${(20 * Math.log10(peak)).toFixed(0)} dBFS`;
}

// Poll the audio graph independently of visual frames.
setInterval(() => {
  const el = document.getElementById('audiostate');
  if (!el) return;
  let status = 'audio not started';
  if (A) {
    const context = Tone.getContext();
    status = `audio ${context.state} · ${Math.round((context.rawContext.baseLatency || 0) * 1000)} ms · hits ${hits}`;
    if (playback.playing && context.state === 'running') {
      status += ' · ' + A.probes.map(({ name, waveform }) => `${name} ${probeLevel(waveform)}`).join(' · ');
    }
  }
  if (lastError) status += ` · error: ${lastError}`;
  const text = ' · ' + status;
  if (el.textContent !== text) el.textContent = text;
}, 125);

// ---------------------------------------------------------------- start

render();
const startEl = document.getElementById('start');
const startStatus = document.getElementById('start-status');
let starting = false;
let contextTransition = null;

function syncAudioContext() {
  if (!audioContext || contextTransition || audioContext.state === 'closed') return;
  const playing = playback.playing;
  if (playing === (audioContext.state === 'running')) return;
  const operation = playing ? audioContext.resume() : audioContext.rawContext.suspend();
  contextTransition = operation.catch(report).finally(() => {
    contextTransition = null;
    if (playing !== playback.playing) syncAudioContext();
  });
}

playback.subscribe(({ type, time }) => {
  if (type === 'seek') {
    scheduledUntil = time;
    seenTweens = new WeakSet();
    if (A) {
      Tone.getDraw().cancel(0);
      Object.values(names).forEach((el) => el.classList.remove('hit'));
      disposeGraph();
      build();
    }
  } else {
    // Freezing the audio context also freezes the queued notes. Keep their
    // scheduling cursor on pause so the same events aren't queued on resume.
    syncAudioContext();
  }
  scheduleAudio();
});

async function begin() {
  if (A) return;
  if (starting) {
    // A click can unlock a pending autoplay attempt.
    audioContext?.resume().catch(report);
    return;
  }
  starting = true;
  lastError = '';
  startStatus.textContent = 'starting sound…';
  try {
    if (!window.Tone) throw new Error('Tone.js could not load. Reload the page to retry.');
    if (!window.tile) throw new Error('The mosaic could not start. Reload the page to retry.');
    if (!audioContext) {
      audioContext = new Tone.Context({ latencyHint: 'playback', lookAhead: 0.15, updateInterval: 0.025 });
      Tone.setContext(audioContext);
    }
    await audioContext.resume();
    if (audioContext.state !== 'running') throw new Error('Audio is still suspended. Select Start again.');
    build();
    playback.useTimeSource(() => audioContext.rawContext.currentTime);
    audioContext.on('tick', scheduleAudio);
    scheduledUntil = playback.time;
    playback.play();
    record();
    startEl.classList.add('gone');
  } catch (error) {
    audioContext?.off('tick', scheduleAudio);
    disposeGraph();
    playback.pause();
    report(error);
    startStatus.textContent = error.message;
  } finally {
    starting = false;
  }
}
startEl.onclick = begin;
startEl.onkeydown = (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  begin();
};
// Resume after a browser interruption, only while the user intends to play.
const wake = () => { if (A && playback.playing) syncAudioContext(); };
addEventListener('pointerdown', wake);
addEventListener('keydown', wake);
document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
if (new URLSearchParams(location.search).has('autostart')) begin();
onFileChange((name) => {
  if (['playback.js', 'sound.js', 'sound.html'].includes(name)) location.reload();
});
const logTo = new URLSearchParams(location.search).get('logto');   // testing: send the log to a local receiver
if (LOG && logTo) setInterval(() => navigator.sendBeacon(logTo, logEl.textContent), 2000);
// testing: ?stats logs, each second, the output's peak, clipped samples, and roughness
// (sample-to-sample jumps relative to the level: crackle and quantisation noise raise it)
function record() {
  if (!LOG || !new URLSearchParams(location.search).has('stats')) return;
  let acc = { peak: 0, clip: 0, d2: 0, s2: 0 }, ticks = 0;
  setInterval(() => {
    if (!A || !playback.playing) return;
    if (!A.statsWave) {
      A.statsWave = new Tone.Waveform(8192);
      A.output.connect(A.statsWave);
    }
    const x = A.statsWave.getValue();
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
}
// testing: ?rewindAt=8 presses rewind once the animation passes 8 s
const rewindAt = +new URLSearchParams(location.search).get('rewindAt');
if (rewindAt) { let done = false; setInterval(() => { if (!done && tile.time > rewindAt) { done = true; if (LOG) logEl.textContent += 'REWIND\n'; document.getElementById('rewind').click(); } }, 50); }
// testing: ?meterlog logs the level exactly as the status line reads it (4 times a second)
if (LOG && new URLSearchParams(location.search).has('meterlog'))
  setInterval(() => { if (A) logEl.textContent += `${tile.time.toFixed(2)} meter ${Math.max(...[].concat(A.meter.getValue())).toFixed(0)}\n`; }, 250);
// testing: ?spectrum logs, per drum channel, how much of its energy is above 12 kHz (inaudible on small speakers)
if (LOG && new URLSearchParams(location.search).has('spectrum')) setInterval(() => {
  if (!A) return;
  for (const id of ['kick', 'snare', 'hats']) {
    if (!A['fft_' + id]) { A['fft_' + id] = new Tone.FFT({ size: 4096, normalRange: true }); A.muteGain[id].connect(A['fft_' + id]); A['acc_' + id] = [0, 0]; }
    const f = A['fft_' + id].getValue(), ny = Tone.getContext().sampleRate / 2;
    f.forEach((m, k) => { const e = m * m; A['acc_' + id][0] += e; if (k / f.length * ny > 12000) A['acc_' + id][1] += e; });
  }
  if (tile.time > 70 && !A.spectrumDone) { A.spectrumDone = true;
    for (const id of ['kick', 'snare', 'hats']) { const [all, hi] = A['acc_' + id]; logEl.textContent += `spectrum ${id}: ${all ? (100 * hi / all).toFixed(0) : '-'}% of energy above 12 kHz\n`; } }
}, 50);
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
if (clickName) clickName.split(',').forEach((n) => [...gui.querySelectorAll('.name')].find((e) => e.textContent.trim() === n)?.click());
})();
