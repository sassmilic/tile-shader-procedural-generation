#version 300 es
precision highp float;

// ---------------------------------------------------------------------------
// Tile shader sandbox
// Grid coordinates: (0,0) bottom-left .. (16,16) top-right, integer = grid line.
// ---------------------------------------------------------------------------

uniform vec2 u_resolution;   // canvas size in device pixels
uniform vec2 u_mouse;        // mouse position in grid units (-100 when outside)
uniform int  u_step;         // draw steps 0..u_step (large = all)

out vec4 outColor;

const float GRID   = 16.0;
const float MARGIN = 1.2;    // grid units of padding around the 16x16 square (must match main.js)

// ---------- signed distance primitives (distances in grid units) ----------

float sdCircle(vec2 p, vec2 c, float r) {
    return length(p - c) - r;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// Signed distance to triangle abc (negative inside). Inigo Quilez.
float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
    vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
    vec2 v0 = p - p0,  v1 = p - p1,  v2 = p - p2;
    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    float s = sign(e0.x * e2.y - e0.y * e2.x);
    vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                     vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                     vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
    return -sqrt(d.x) * sign(d.y);
}

// ---------- rasterisation helpers (anti-aliased) ----------

// Size of one pixel in grid units (set in main()). Using a constant instead of
// fwidth(d) avoids artefacts where d has kinks (fwidth -> 0 there).
float PX = 0.01;

// Coverage of the region d < 0.
float fill(float d) {
    return 1.0 - smoothstep(-0.5 * PX, 0.5 * PX, d);
}

// Coverage of a stroke of total width w (grid units) centred on d = 0.
float stroke(float d, float w) {
    return fill(abs(d) - 0.5 * w);
}

// Paint `col` over `base` with coverage `a`.
vec3 paint(vec3 base, vec3 col, float a) {
    return mix(base, col, clamp(a, 0.0, 1.0));
}

// ---------- background grid ----------

vec3 background(vec2 p) {
    vec3 col = vec3(0.96, 0.95, 0.92);                       // paper
    bool inside = all(greaterThanEqual(p, vec2(0.0))) && all(lessThanEqual(p, vec2(GRID)));
    if (!inside) return vec3(0.90, 0.89, 0.86);

    // distance to nearest integer line / nearest multiple-of-4 line
    vec2 g1 = abs(fract(p + 0.5) - 0.5);
    vec2 g4 = abs(fract(p / 4.0 + 0.5) - 0.5) * 4.0;
    float d1 = min(g1.x, g1.y);
    float d4 = min(g4.x, g4.y);

    col = paint(col, vec3(0.80, 0.79, 0.75), stroke(d1, 0.03));
    col = paint(col, vec3(0.62, 0.61, 0.57), stroke(d4, 0.06));
    return col;
}

void main() {
    // pixel -> grid units, (0,0) bottom-left of the 16x16 square
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = uv * (GRID + 2.0 * MARGIN) - MARGIN;
    PX = (GRID + 2.0 * MARGIN) / u_resolution.y;

    vec3 col = background(p);

    // outer 16x16 border
    float dBox = max(abs(p.x - 8.0), abs(p.y - 8.0)) - 8.0;
    col = paint(col, vec3(0.35, 0.34, 0.32), stroke(dBox, 0.08));

    // =====================================================================
    // === DRAWING STEPS ===================================================
    // Each step: a "// Step N: description" line (shown in the page's step
    // list) followed by a block gated on u_step, so the page can replay
    // the drawing up to any step.
    // =====================================================================

    // Named points
    vec2 A = vec2(0.0, 0.0);
    vec2 B = vec2(16.0, 0.0);
    vec2 C = vec2(0.0, 16.0);

    // Clip mask for the 16x16 square (shapes don't spill into the margin).
    float inSquare = fill(dBox);

    // Step 0: right triangle A(0,0) B(16,0) C(0,16), right angle at A
    if (u_step >= 0) {
        float d = sdTriangle(p, A, B, C);
        col = paint(col, vec3(0.20, 0.45, 0.85), 0.18 * fill(d));   // soft fill
        col = paint(col, vec3(0.10, 0.25, 0.60), stroke(d, 0.12));  // outline
    }

    // Step 1: circle at A(0,0), r=6, filled black
    if (u_step >= 1) {
        float d = sdCircle(p, A, 6.0);
        col = paint(col, vec3(0.0), fill(d) * inSquare);
    }

    // Step 2: circle at A(0,0), r=3, filled white
    if (u_step >= 2) {
        float d = sdCircle(p, A, 3.0);
        col = paint(col, vec3(1.0), fill(d) * inSquare);
    }

    // =====================================================================
    // === END DRAWING STEPS ===============================================
    // =====================================================================

    // hover marker at the nearest grid point
    vec2 m = floor(u_mouse + 0.5);
    float dm = sdCircle(p, m, 0.22);
    col = paint(col, vec3(0.90, 0.30, 0.15), stroke(dm, 0.07));

    outColor = vec4(col, 1.0);
}
