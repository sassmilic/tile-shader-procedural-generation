// Minimal WebGL2 renderer for a full-screen fragment shader (shared by
// index.html, the build animation, tile.html and compare.html).
//
//   const r = createRenderer(canvas);
//   r.load(fragSource)      -> null on success, or the compile error message
//   r.draw({ u_step: 5, u_viewMin: [0, 0], ... })   uniforms set by name/type

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true });
  if (!gl) throw new Error('WebGL2 not supported');

  const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  let program = null;
  let uniforms = {};   // name -> { loc, type }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(log);
    }
    return s;
  }

  // Compile and link; keeps the previous program if this one fails.
  function load(fragSrc) {
    try {
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, 'a_pos');
      gl.linkProgram(p);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      if (program) gl.deleteProgram(program);
      program = p;
      uniforms = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        const u = { loc: gl.getUniformLocation(p, info.name), type: info.type };
        uniforms[info.name] = u;
        // arrays are reported as "S[0]"; also allow setting the whole array as "S"
        if (info.name.endsWith('[0]')) uniforms[info.name.slice(0, -3)] = u;
      }
      return null;
    } catch (e) {
      return e.message;
    }
  }

  function setUniform(name, value) {
    const u = uniforms[name];
    if (!u) return;   // unused by the shader (optimised away)
    switch (u.type) {
      case gl.FLOAT:      Array.isArray(value) ? gl.uniform1fv(u.loc, value) : gl.uniform1f(u.loc, value); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, value); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, value); break;   // a vec4 or a flat vec4 array
      case gl.INT:
      case gl.BOOL:       gl.uniform1i(u.loc, Number(value)); break;
      default: throw new Error('unsupported uniform type for ' + name);
    }
  }

  function draw(values) {
    if (!program) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    setUniform('u_resolution', [canvas.width, canvas.height]);
    for (const [name, value] of Object.entries(values)) setUniform(name, value);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return { load, draw };
}

// "// Step N: text" comments of shader.frag, sorted by N.
function parseSteps(src) {
  return [...src.matchAll(/^[ \t]*\/\/[ \t]*Step[ \t]+(\d+)[ \t]*:[ \t]*(.*)$/gm)]
    .map((m) => ({ n: Number(m[1]), text: m[2].trim() }))
    .sort((a, b) => a.n - b.n);
}

// A Shadertoy-style program (void mainImage(out vec4 o, vec2 fragCoord), iResolution)
// made into a complete WebGL2 fragment shader.
function wrapShadertoy(src) {
  return `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float iTime;   // seconds (0 unless the page passes it)
#define iResolution vec3(u_resolution, 1.)
out vec4 fragColor_;
${src}
void main() { mainImage(fragColor_, gl_FragCoord.xy); }`;
}

// Preserve the animated decay rate while changing how it shades the distance field.
function glowOutputParts(output, mode) {
  const match = output?.match(/^o = vec4\(vec3\(exp\(-\(([\d.]+)(.*?)\) \* max\(D, 0\.\)\)\), 1\);$/);
  if (!match) return null;
  const [, rate, pulse] = match;
  if (mode === 'rim') {
    return ['o = vec4(vec3(mix(.32 * exp(-(', rate,
      `${pulse}) * (2. * max(D, 0.))), 1., clamp(.5 - D / max(fwidth(D), 1e-6), 0., 1.))), 1);`];
  }
  const distance = mode === 'tight' ? '(3. * max(D, 0.))' : 'max(D, 0.)';
  return ['o = vec4(vec3(exp(-(', rate, `${pulse}) * ${distance})), 1);`];
}

function setupGlowSelect(select) {
  const requested = new URLSearchParams(location.search).get('glow');
  if ([...select.options].some((option) => option.value === requested)) select.value = requested;
}

const GOLF_TYPES = ['#define F float', '#define Q vec2'];
const GOLF_NAMES = new Map(Object.entries({
  float: 'F', vec2: 'Q', smin: 'S', add: 'A', cut: 'K', circle: 'C', rect: 'B', tri: 'T', melt: 'm',
}));

// Compact the pattern's GLSL while keeping the animation's number slots intact.
function golfShaderParts(parts) {
  const slots = parts.filter((part) => typeof part !== 'string');
  const line = parts.map((part) => typeof part === 'string' ? part : '\0').join('').trim();
  if (line.startsWith('#')) return parts;
  const compact = line.replace(/\b[a-z_]\w*\b/gi, (name) => GOLF_NAMES.get(name) ?? name)
    .replace(/\s+/g, (gap, i, source) => {
      const before = source[i - 1], right = source[i + gap.length];
      const joinsWords = /[\w\0]/.test(before) && /[\w\0]/.test(right);
      const joinsOperator = (before === '+' && right === '+') || (before === '-' && /[-\0]/.test(right));
      return joinsWords || joinsOperator ? ' ' : '';
    });
  return compact.split('\0').flatMap((text, i) => i ? [slots[i - 1], text] : [text]);
}

function golfShaderSource(source) {
  const lines = source.split('\n').map((line) => line.replace(/\/\/.*$/, ''));
  // The comparison view also accepts custom shaders, including their own aliases and macros.
  if (lines.some((line) => /^\s*#|\/\*|\b(?:F|Q|A|B|C|K|S|T|m)\b/.test(line))) return source;
  return [...GOLF_TYPES, ...lines.map((line) => golfShaderParts([line]).join(''))].join('\n').trimEnd();
}

// Live reload: when running on the dev server (node serve.js), call fn(fileName)
// whenever a watched file is saved. On a static host (GitHub Pages) there is no
// dev server, so it does nothing instead of retrying forever.
function onFileChange(fn) {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
  new EventSource('/events').addEventListener('message', (e) => fn(e.data));
}

async function fetchShader(name = 'shader.frag') {
  return (await fetch(name + '?t=' + Date.now(), { cache: 'no-store' })).text();
}
