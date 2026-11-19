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

// Unsigned distance to the quadratic Bezier curve a -> b with control point ctrl:
// the curve leaves a heading toward ctrl and arrives at b coming from ctrl.
// Inigo Quilez.
float dot2(vec2 v) { return dot(v, v); }
float sdBezier(vec2 pos, vec2 a, vec2 ctrl, vec2 b) {
    vec2 A = ctrl - a;
    vec2 B = a - 2.0 * ctrl + b;
    vec2 C = A * 2.0;
    vec2 D = a - pos;
    float kk = 1.0 / dot(B, B);
    float kx = kk * dot(A, B);
    float ky = kk * (2.0 * dot(A, A) + dot(D, B)) / 3.0;
    float kz = kk * dot(D, A);
    float res;
    float p = ky - kx * kx;
    float p3 = p * p * p;
    float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
    float h = q * q + 4.0 * p3;
    if (h >= 0.0) {
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
        float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
        res = dot2(D + (C + B * t) * t);
    } else {
        float z = sqrt(-p);
        float v = acos(q / (p * z * 2.0)) / 3.0;
        float m = cos(v);
        float n = sin(v) * 1.732050808;
        vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
        res = min(dot2(D + (C + B * t.x) * t.x),
                  dot2(D + (C + B * t.y) * t.y));
    }
    return sqrt(res);
}

// Signed distance to a closed polygon v[0..n-1] (negative inside). Inigo Quilez.
// Fill unused slots of v with anything; only the first n are read.
const int MAX_POLY = 16;
float sdPolygon(vec2 p, vec2 v[MAX_POLY], int n) {
    float d = dot(p - v[0], p - v[0]);
    float s = 1.0;
    for (int i = 0, j = n - 1; i < n; j = i, i++) {
        vec2 e = v[j] - v[i];
        vec2 w = p - v[i];
        vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
        d = min(d, dot(b, b));
        bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
        if (all(c) || all(not(c))) s *= -1.0;
    }
    return s * sqrt(d);
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

    // Clip mask: the triangle ABC. RULE: nothing is ever drawn outside the
    // triangle -- every step multiplies its coverage by inTri.
    float inTri = fill(sdTriangle(p, A, B, C));

    // Step 0: right triangle A(0,0) B(16,0) C(0,16), right angle at A
    if (u_step >= 0) {
        float d = sdTriangle(p, A, B, C);
        col = paint(col, vec3(0.20, 0.45, 0.85), 0.18 * fill(d));   // soft fill
        col = paint(col, vec3(0.10, 0.25, 0.60), stroke(d, 0.12));  // outline
    }

    // Step 1: circle at A(0,0), r=9, filled white
    if (u_step >= 1) {
        float d = sdCircle(p, A, 9.0);
        col = paint(col, vec3(1.0), fill(d) * inTri);
    }

    // Step 2: circle at A(0,0), r=6, filled black
    if (u_step >= 2) {
        float d = sdCircle(p, A, 6.0);
        col = paint(col, vec3(0.0), fill(d) * inTri);
    }

    // Step 3: circle at A(0,0), r=3, filled white
    if (u_step >= 3) {
        float d = sdCircle(p, A, 3.0);
        col = paint(col, vec3(1.0), fill(d) * inTri);
    }

    // Step 4: circle at C(0,16), r=3, filled black
    if (u_step >= 4) {
        float d = sdCircle(p, C, 3.0);
        col = paint(col, vec3(0.0), fill(d) * inTri);
    }

    // Step 5: circle at C(0,16), r=2, filled white
    if (u_step >= 5) {
        float d = sdCircle(p, C, 2.0);
        col = paint(col, vec3(1.0), fill(d) * inTri);
    }

    // Step 6: black line (0,6) -> (3,8.5) -> (7.5,8.5), width 0.15
    if (u_step >= 6) {
        float d = min(sdSegment(p, vec2(0.0, 6.0), vec2(3.0, 8.5)),
                      sdSegment(p, vec2(3.0, 8.5), vec2(7.5, 8.5)));
        col = paint(col, vec3(0.0), stroke(d, 0.15) * inTri);
    }

    // Step 7: black curve (0,9) -> (1.7,12), leaves flat, arrives vertical (Bezier ctrl (1.7,9)), width 0.15
    if (u_step >= 7) {
        float d = sdBezier(p, vec2(0.0, 9.0), vec2(1.7, 9.0), vec2(1.7, 12.0));
        col = paint(col, vec3(0.0), stroke(d, 0.15) * inTri);
    }

    // Step 8: black curve (1.7,12) -> (5.5,10.5), bulges to lower-left like a petal (Bezier ctrl (2.9,9.4)), width 0.15
    if (u_step >= 8) {
        float d = sdBezier(p, vec2(1.7, 12.0), vec2(2.9, 9.4), vec2(5.5, 10.5));
        col = paint(col, vec3(0.0), stroke(d, 0.15) * inTri);
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
