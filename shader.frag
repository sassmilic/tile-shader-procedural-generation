#version 300 es
precision highp float;

// ---------------------------------------------------------------------------
// Tile shader sandbox
// Grid coordinates: (0,0) bottom-left .. (16,16) top-right, integer = grid line.
// ---------------------------------------------------------------------------

uniform vec2 u_resolution;   // canvas size in device pixels
uniform vec2 u_mouse;        // mouse position in grid units (-100 when outside)
uniform int  u_step;         // draw steps 0..u_step (large = all)
uniform float u_fade;        // fade-in (0..1) of step u_step itself (1 = fully drawn)
uniform bool u_edit;         // true: editing view (grid, guides); false: display view
uniform int  u_fold;         // display view: reflection stage (0..4, see fold(); 4 = full tiling)
uniform vec2 u_viewMin;      // world window, bottom-left corner (grid units)
uniform vec2 u_viewSize;     // world window size (grid units)

out vec4 outColor;

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

// Point on a quadratic Bezier at parameter t.
vec2 bezierAt(vec2 a, vec2 ctrl, vec2 b, float t) {
    return mix(mix(a, ctrl, t), mix(ctrl, b, t), t);
}

// y of a quadratic Bezier at a given x. Only valid for curves whose x is
// monotonic between a.x and b.x (i.e. the curve is a function y(x)).
float bezierYatX(vec2 a, vec2 ctrl, vec2 b, float x) {
    float k2 = a.x - 2.0 * ctrl.x + b.x;
    float k1 = 2.0 * (ctrl.x - a.x);
    float k0 = a.x - x;
    float t;
    if (abs(k2) < 1e-5) {
        t = -k0 / k1;
    } else {
        float s = sqrt(max(k1 * k1 - 4.0 * k2 * k0, 0.0));
        float t1 = (-k1 + s) / (2.0 * k2);
        float t2 = (-k1 - s) / (2.0 * k2);
        t = (t1 >= -1e-4 && t1 <= 1.0 + 1e-4) ? t1 : t2;
    }
    return bezierAt(a, ctrl, b, clamp(t, 0.0, 1.0)).y;
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

// ---------- step painting ----------

vec3 col;          // current pixel colour
float covered;     // how much of this pixel the drawing steps have painted (0..1)

// Paint a drawing step: colour c with coverage a. Also records coverage so a
// later step can fill "whatever is still unfilled".
void draw(vec3 c, float a) {
    col = paint(col, c, a);
    covered = max(covered, clamp(a, 0.0, 1.0));
}

// ---------- smooth blending ----------

// Smooth minimum (polynomial, Inigo Quilez): union of two shapes with a
// rounded fillet of size ~k where they meet. k <= 0 gives a plain min.
float smin(float a, float b, float k) {
    if (k <= 0.0) return min(a, b);
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}
// Smooth maximum: smooth intersection; smax(a, -b, k) = smooth "a minus b".
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

// Axis-aligned rectangle from corner lo to corner hi.
float sdBox(vec2 p, vec2 lo, vec2 hi) {
    vec2 q = abs(p - 0.5 * (lo + hi)) - 0.5 * (hi - lo);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// ---------- graph paper ----------

// Grid lines over everything (the sheet is black): every unit, stronger every
// 4 units, strongest on the axes x = 0 and y = 0.
vec3 gridLines(vec2 p, vec3 c) {
    vec2 g1 = abs(fract(p + 0.5) - 0.5);
    vec2 g4 = abs(fract(p / 4.0 + 0.5) - 0.5) * 4.0;
    vec3 ink = vec3(0.5);
    c = paint(c, ink, 0.30 * stroke(min(g1.x, g1.y), 0.03));
    c = paint(c, ink, 0.45 * stroke(min(g4.x, g4.y), 0.05));
    c = paint(c, ink, 0.70 * stroke(min(abs(p.x), abs(p.y)), 0.06));
    return c;
}

// =====================================================================
// === STEP LANGUAGE ===================================================
// Tiny helpers so that every drawing step is a single line.
// Distances are in grid units and measured from the current point P.
// =====================================================================

// Named points of the base triangle, and colours
const vec2 A = vec2(0.0, 0.0);
const vec2 B = vec2(16.0, 0.0);
const vec2 C = vec2(0.0, 16.0);
const vec3 WHITE = vec3(1.0);
const vec3 BLACK = vec3(0.0);
const float LINE_WIDTH = 0.15;
const float OUTSIDE = 0.3;     // editing view: brightness of shapes outside the triangle

vec2 P;            // the point being shaded (set by pattern())
float FADE = 1.0;  // fade-in of the step being animated (set by at())

vec2 v(float x, float y) { return vec2(x, y); }

// shapes: signed distance from P (< 0 inside)
float circle(vec2 c, float r)            { return sdCircle(P, c, r); }
float box(vec2 lo, vec2 hi)              { return sdBox(P, lo, hi); }
float segment(vec2 a, vec2 b)            { return sdSegment(P, a, b); }
float curve(vec2 a, vec2 ctrl, vec2 b)   { return sdBezier(P, a, ctrl, b); }   // quadratic Bezier
float thick(float d)                     { return abs(d) - 0.5 * LINE_WIDTH; } // a line as a shape
float tri(vec2 a, vec2 b, vec2 c)        { return sdTriangle(P, a, b, c); }
float poly4(vec2 a, vec2 b, vec2 c, vec2 d) {
    vec2 q[MAX_POLY]; q[0] = a; q[1] = b; q[2] = c; q[3] = d;
    return sdPolygon(P, q, 4);
}
float poly5(vec2 a, vec2 b, vec2 c, vec2 d, vec2 e) {
    vec2 q[MAX_POLY]; q[0] = a; q[1] = b; q[2] = c; q[3] = d; q[4] = e;
    return sdPolygon(P, q, 5);
}

// painters (shapes are drawn whole; faded in when animated)
void shape(float d, vec3 c) { draw(c, fill(d) * FADE); }
void line(float d, vec3 c)  { shape(thick(d), c); }
// Fill whatever is still unfilled. smoothstep: where two shapes meet
// edge-to-edge each covers ~50%, so >= 50% counts as covered (no dark seam).
void fillRest(vec3 c) { draw(c, (1.0 - smoothstep(0.0, 0.5, covered)) * FADE); }

// Step gate: is step n drawn? The step being animated (n == u_step) fades in.
bool at(int n) {
    FADE = (n == u_step) ? u_fade : 1.0;
    return n <= u_step;
}

// =====================================================================
// === DRAWING STEPS ===================================================
// The pattern of the base triangle ABC, painted over `base` (black).
// Each step: a "// Step N: description" line (shown in the step list and
// the animation) followed by ONE line gated on at(N).
// Shapes are drawn whole. Only what lands inside the triangle is tiled, so
// the editing view dims everything outside it.
// =====================================================================
vec3 pattern(vec2 p, vec3 base) {
    P = p; col = base; covered = 0.0;

    // Step 1: circle at (-2.3,6), r=8.8, filled white
    if (at(1)) shape(circle(v(-2.3, 6.0), 8.8), WHITE);

    // Step 2: circle at (-1.8,-0.1), r=11.2, filled black
    if (at(2)) shape(circle(v(-1.8, -0.1), 11.2), BLACK);

    // Step 3: circle at A(0,0), r=9, filled white
    if (at(3)) shape(circle(A, 9.0), WHITE);

    // Step 4: rectangle (8,0) to (8.5,8), filled white
    if (at(4)) shape(box(v(8.0, 0.0), v(8.5, 8.0)), WHITE);

    // Step 5: circle at A(0,0), r=6, filled black
    if (at(5)) shape(circle(A, 6.0), BLACK);

    // Step 6: triangle (6,0) (9.5,0) (9.5,4.2), filled black
    if (at(6)) shape(tri(v(6.0, 0.0), v(9.5, 0.0), v(9.5, 4.2)), BLACK);

    // Step 7: rectangle (9,0) to (9.5,8), filled white
    if (at(7)) shape(box(v(9.0, 0.0), v(9.5, 8.0)), WHITE);

    // Step 8: triangle (7,0) (9.5,0) (9.5,3.3), filled white
    if (at(8)) shape(tri(v(7.0, 0.0), v(9.5, 0.0), v(9.5, 3.3)), WHITE);

    // Step 9: triangle (8,0) (9.5,0) (9.5,2), filled black
    if (at(9)) shape(tri(v(8.0, 0.0), v(9.5, 0.0), v(9.5, 2.0)), BLACK);

    // Step 10: circle at A(0,0), r=3, filled white
    if (at(10)) shape(circle(A, 3.0), WHITE);

    // Step 11: circle at (13,-4.1), r=5.8, filled white
    if (at(11)) shape(circle(v(13.0, -4.1), 5.8), WHITE);

    // Step 12: circle at (18.3,6.5), r=8, filled white
    if (at(12)) shape(circle(v(18.3, 6.5), 8.0), WHITE);

    // Step 13: circle at (4.5,9), r=1.1, filled white
    if (at(13)) shape(circle(v(4.5, 9.0), 1.1), WHITE);

    // Step 14: circle at (3.5,10.5), r=0.5, filled black
    if (at(14)) shape(circle(v(3.5, 10.5), 0.5), BLACK);

    // Step 15: circle at (2,10.7), r=1, filled white
    if (at(15)) shape(circle(v(2.0, 10.7), 1.0), WHITE);

    // Step 16: circle at (0.8,11.2), r=0.3, filled black
    if (at(16)) shape(circle(v(0.8, 11.2), 0.3), BLACK);

    // Step 17: circle at (0.25,10.5), r=0.3, filled white
    if (at(17)) shape(circle(v(0.25, 10.5), 0.3), WHITE);

    // Step 18: rectangle (2.5,13) to (4,14), filled black
    if (at(18)) shape(box(v(2.5, 13.0), v(4.0, 14.0)), BLACK);

    return col;
}
// =====================================================================
// === END DRAWING STEPS ===============================================
// =====================================================================

// =====================================================================
// === REFLECTIONS =====================================================
// Reflecting = mapping every point p back into triangle ABC. The finished
// tiling (stage 4) is just TWO lines:
//
//     p = abs(mod(p + 16.0, 32.0) - 16.0);       mirror lines x = 16k, y = 16k
//     p = p.x + p.y > 16.0 ? 16.0 - p.yx : p;    mirror across the slanted edge
//
// The stages in between show how it builds up. Each line is gated by the
// stages it belongs to; "// Fold k:" marks the stage that introduces it
// (the animation types those lines out).
// =====================================================================
vec2 fold(vec2 p, int stage) {
    if (stage == 1) p.x = abs(p.x);                           // Fold 1: mirror across the left edge
    if (stage == 2 || stage == 3) p = abs(p);                 // Fold 2: mirror across the bottom edge too
    if (stage >= 4) p = abs(mod(p + 16.0, 32.0) - 16.0);      // Fold 4: repeat the mirrors every 16 units
    if (stage >= 3) p = p.x + p.y > 16.0 ? 16.0 - p.yx : p;   // Fold 3: mirror across the slanted edge
    return p;
}

// Area covered after each fold stage: triangle, big triangle, diamond,
// 32x32 square, everything. (Only outer edges are anti-aliased; the mirror
// lines inside stay seamless.)
float foldArea(vec2 p, int stage) {
    if (stage <= 0) return fill(sdTriangle(p, A, B, C));
    if (stage == 1) return fill(sdTriangle(p, vec2(-B.x, B.y), B, C));
    if (stage == 2) return fill((abs(p.x) + abs(p.y) - 16.0) * 0.70710678);
    if (stage == 3) return fill(max(abs(p.x), abs(p.y)) - 16.0);
    return 1.0;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    if (u_edit) {
        // Editing view: graph paper zoomed out to the window u_viewMin ..
        // u_viewMin + u_viewSize, big enough to show every shape whole.
        vec2 p = u_viewMin + uv * u_viewSize;
        PX = u_viewSize.y / u_resolution.y;

        vec3 c = pattern(p, BLACK);                                 // the sheet is black
        c *= mix(OUTSIDE, 1.0, fill(sdTriangle(p, A, B, C)));        // dim what won't be tiled
        c = gridLines(p, c);

        // Step 0: right triangle A(0,0) B(16,0) C(0,16), right angle at A (guide; editing view only)
        if (u_step >= 0) c = paint(c, vec3(0.35, 0.6, 1.0), stroke(sdTriangle(p, A, B, C), 0.1));

        // hover marker at the nearest grid point
        vec2 m = floor(u_mouse + 0.5);
        c = paint(c, vec3(1.0, 0.45, 0.2), stroke(sdCircle(p, m, 0.22), 0.07));
        outColor = vec4(c, 1.0);
    } else {
        // Display view: the base triangle folded u_fold times, shown in the
        // world window u_viewMin .. u_viewMin + u_viewSize.
        vec2 p = u_viewMin + uv * u_viewSize;
        PX = u_viewSize.y / u_resolution.y;

        // fold() maps every point into the triangle, so nothing needs clipping
        // (and mirror lines get no anti-aliased seams). It starts out black.
        vec3 c = pattern(fold(p, u_fold), BLACK);
        float a = foldArea(p, u_fold);
        outColor = vec4(c * a, a);                                          // premultiplied alpha
    }
}
