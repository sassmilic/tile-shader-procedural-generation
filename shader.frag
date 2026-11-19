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
uniform bool u_edit;         // true: editing view (grid, border, guides); false: display view
uniform int  u_fold;         // display view: number of reflections (0..3, see fold())
uniform float u_foldFade;    // display view: fade-in (0..1) of the area added by fold u_fold
uniform vec2 u_viewMin;      // display view: world window, bottom-left corner (grid units)
uniform vec2 u_viewSize;     // display view: world window size (grid units)
const float BLEND = 0.30;     // smooth-blend radius in grid units (step 24)

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

vec2 P;            // the point being shaded (set by pattern())
float CLIP;        // triangle clip mask for this pixel (set by pattern())
float FADE = 1.0;  // fade-in of the step being animated (set by at())

vec2 v(float x, float y) { return vec2(x, y); }

// shapes: signed distance from P (< 0 inside)
float circle(vec2 c, float r)            { return sdCircle(P, c, r); }
float box(vec2 lo, vec2 hi)              { return sdBox(P, lo, hi); }
float segment(vec2 a, vec2 b)            { return sdSegment(P, a, b); }
float curve(vec2 a, vec2 ctrl, vec2 b)   { return sdBezier(P, a, ctrl, b); }   // quadratic Bezier
float thick(float d)                     { return abs(d) - 0.5 * LINE_WIDTH; } // a line as a shape
float poly4(vec2 a, vec2 b, vec2 c, vec2 d) {
    vec2 q[MAX_POLY]; q[0] = a; q[1] = b; q[2] = c; q[3] = d;
    return sdPolygon(P, q, 4);
}
float poly5(vec2 a, vec2 b, vec2 c, vec2 d, vec2 e) {
    vec2 q[MAX_POLY]; q[0] = a; q[1] = b; q[2] = c; q[3] = d; q[4] = e;
    return sdPolygon(P, q, 5);
}

// painters (all clipped to the triangle and faded in when animated)
void shape(float d, vec3 c) { draw(c, fill(d) * CLIP * FADE); }
void line(float d, vec3 c)  { shape(thick(d), c); }
// Fill whatever is still unfilled. smoothstep: where two shapes meet
// edge-to-edge each covers ~50%, so >= 50% counts as covered (no dark seam).
void fillRest(vec3 c) { draw(c, (1.0 - smoothstep(0.0, 0.5, covered)) * CLIP * FADE); }

// Step gate: is step n drawn? The step being animated (n == u_step) fades in.
bool at(int n) {
    FADE = (n == u_step) ? u_fade : 1.0;
    return n <= u_step;
}

// ---------- named regions used by the steps ----------

// Above the step 6 line, extended back to (0,6). The line rises then runs
// flat (concave), so "above" is the union of the regions above both segments.
float aboveStep6() {
    vec2 l0 = v(0.0, 6.0), l1 = v(3.0, 8.5), l2 = v(7.5, 8.5);
    vec2 n1 = normalize(vec2(l1.y - l0.y, l0.x - l1.x));   // points below segment 1
    vec2 n2 = normalize(vec2(l2.y - l1.y, l1.x - l2.x));   // points below segment 2
    return min(dot(P - l0, n1), dot(P - l1, n2));
}

// Below the petal curve: step 7 (0,9)->(1.7,12) then step 8 (1.7,12)->(5.5,10.5).
// For x > 5.5 (between the curve's end and the slanted edge) everything counts as below.
float belowPetals() {
    vec2 c0 = v(0.0, 9.0), c1 = v(1.7, 9.0), c2 = v(1.7, 12.0);   // step 7
    vec2 e1 = v(2.9, 9.4), e2 = v(5.5, 10.5);                     // step 8 (starts at c2)
    float dCurve = min(sdBezier(P, c0, c1, c2), sdBezier(P, c2, e1, e2));
    float yCurve = P.x < c2.x ? bezierYatX(c0, c1, c2, P.x)
                 : P.x < e2.x ? bezierYatX(c2, e1, e2, P.x)
                 : 1e3;
    return P.y < yCurve ? -dCurve : dCurve;
}

// The lower-right shapes (steps 13-23), shared with the step 24 blend.
float s13() { return circle(v(9.0, 4.5), 1.0); }
float s14() { return circle(v(10.7, 2.0), 1.0); }
// (s15 and s16 sit on the bottom edge; they reach down to y = -1 so the edge,
// a mirror line in the tiling, gets no anti-aliased seam. The clip hides y < 0.)
float s15() { return poly4(v(13.5, -1.0), v(14.5, -1.0), v(14.5, 1.0), v(13.5, 2.0)); }
float s16() { return box(v(11.0, -1.0), v(13.0, 2.5)); }
float s17() { return circle(v(11.3, 0.8), 0.4); }
float s18() { return circle(v(11.0, 0.25), 0.3); }
float s19() { return box(v(10.4, 2.0), v(12.0, 6.0)); }
float s20() { return circle(v(10.5, 3.5), 0.8); }
float s21() { return thick(curve(v(7.0, 7.0), v(8.8, 7.45), v(10.0, 6.0))); }
float s22() { return thick(curve(v(7.0, 7.0), v(8.47, 5.85), v(8.05, 4.025))); }

// The leaf: space enclosed by the step 21 + 22 curves, closed off at the
// bottom (y = 4.025) and running into the step 19 rectangle; excludes step 20.
float s23() {
    vec2 s = v(7.0, 7.0);
    vec2 a1 = v(8.8, 7.45),  a2 = v(10.0, 6.0);     // step 21 curve
    vec2 b1 = v(8.47, 5.85), b2 = v(8.05, 4.025);   // step 22 curve

    // The sign tests are extended past the curves' ends (horizontally /
    // vertically) so the distance field has no jumps -- smin/smax turn jumps
    // into visible ridges.
    float d21 = curve(s, a1, a2);
    bool below21 = P.x >= s.x &&
                   (P.x <= a2.x ? P.y < bezierYatX(s, a1, a2, P.x) : P.y < a2.y);
    float d22 = curve(s, b1, b2);
    bool right22 = P.y > s.y ||
                   (P.y >= b2.y ? P.x > bezierYatX(s.yx, b1.yx, b2.yx, P.y) : P.x > b2.x);

    float d = max(max(below21 ? -d21 : d21, right22 ? -d22 : d22), b2.y - P.y);
    return max(d, -s20());
}

// Smoothly blend the lower-right shapes (steps 13-23) together and into the
// r=9 circle around A, with blend radius k.
void blendLowerRight(float k) {
    float dA = circle(A, 9.0);
    // only the lower-right part of the big circle (x > 6.5) takes part in the
    // blend; elsewhere its edge borders black detail we must not touch
    float dAblend = max(dA, 6.5 - P.x);

    // hard union of the white shapes as drawn by steps 13-23 (to erase them)
    float dHard = min(min(min(s13(), s14()), min(s15(), s16())),
                      min(min(s18(), s19()), min(min(s21(), s22()), s23())));

    // smooth version, following the drawing order so later white shapes
    // still sit on top of earlier black notches
    float d = smin(smin(smin(s13(), s14(), k), smin(s15(), s16(), k), k), dAblend, k);
    d = smax(d, -s17(), k);                          // black notch, step 17
    d = smin(smin(d, s18(), k), s19(), k);
    d = smax(d, -s20(), k);                          // black notch, step 20
    // the leaf (steps 21-23) is joined with a hard min so its tip at (7,7)
    // stays sharp; only the leaf as a whole blends with its neighbours
    d = smin(d, min(min(s21(), s22()), s23()), k);

    // never touch the inside of the r=9 circle (its upper-left has black detail);
    // the white paint overlaps its edge by 1px so the neck has no seam
    shape(max(dHard - PX, -dA), BLACK);              // erase the hard shapes
    shape(max(d, -dA - PX), WHITE);                  // paint the blended shape
}

// =====================================================================
// === DRAWING STEPS ===================================================
// The pattern of the base triangle ABC, painted over `base`.
// Each step: a "// Step N: description" line (shown in the step list and
// the animation) followed by ONE line gated on at(N).
// RULE: nothing is ever drawn outside the triangle (the painters clip).
// =====================================================================
vec3 pattern(vec2 p, vec3 base, float inTri) {
    P = p; CLIP = inTri; col = base; covered = 0.0;

    // Step 1: circle at A(0,0), r=9, filled white
    if (at(1)) shape(circle(A, 9.0), WHITE);

    // Step 2: circle at A(0,0), r=6, filled black
    if (at(2)) shape(circle(A, 6.0), BLACK);

    // Step 3: circle at A(0,0), r=3, filled white
    if (at(3)) shape(circle(A, 3.0), WHITE);

    // Step 4: circle at C(0,16), r=3, filled black
    if (at(4)) shape(circle(C, 3.0), BLACK);

    // Step 5: circle at C(0,16), r=2, filled white
    if (at(5)) shape(circle(C, 2.0), WHITE);

    // Step 6: black line (3,8.5) -> (7.5,8.5)
    if (at(6)) line(segment(v(3.0, 8.5), v(7.5, 8.5)), BLACK);

    // Step 7: black curve (0,9) -> (1.7,12), leaves flat, arrives vertical
    if (at(7)) line(curve(v(0.0, 9.0), v(1.7, 9.0), v(1.7, 12.0)), BLACK);

    // Step 8: black curve (1.7,12) -> (5.5,10.5), bulges lower-left like a petal
    if (at(8)) line(curve(v(1.7, 12.0), v(2.9, 9.4), v(5.5, 10.5)), BLACK);

    // Step 9: fill black between the step 6 line and the step 7+8 curve
    if (at(9)) shape(max(aboveStep6(), belowPetals()), BLACK);

    // Step 10: fill the two petals white (above the curve, outside the C ring)
    if (at(10)) shape(max(-belowPetals(), -circle(C, 3.0)), WHITE);

    // Step 11: white stripe (0,6) (3,8.5) (7.5,8.5) (7,9) (2.5,9), grown 1/2 px to hide step 9's edge
    if (at(11)) shape(poly5(v(0.0, 6.0), v(3.0, 8.5), v(7.5, 8.5), v(7.0, 9.0), v(2.5, 9.0)) - 0.5 * PX, WHITE);

    // Step 12: fill all still-unfilled space in the triangle black
    if (at(12)) fillRest(BLACK);

    // Step 13: circle at (9,4.5), r=1, filled white
    if (at(13)) shape(s13(), WHITE);

    // Step 14: circle at (10.7,2), r=1, filled white
    if (at(14)) shape(s14(), WHITE);

    // Step 15: polygon (13.5,0) (14.5,0) (14.5,1) (13.5,2), filled white
    if (at(15)) shape(s15(), WHITE);

    // Step 16: rectangle (11,0) to (13,2.5), filled white
    if (at(16)) shape(s16(), WHITE);

    // Step 17: circle at (11.3,0.8), r=0.4, filled black
    if (at(17)) shape(s17(), BLACK);

    // Step 18: circle at (11,0.25), r=0.3, filled white
    if (at(18)) shape(s18(), WHITE);

    // Step 19: rectangle (10.4,2) to (12,6), filled white
    if (at(19)) shape(s19(), WHITE);

    // Step 20: circle at (10.5,3.5), r=0.8, filled black
    if (at(20)) shape(s20(), BLACK);

    // Step 21: white curve (7,7) -> (10,6), bulges upper-right
    if (at(21)) shape(s21(), WHITE);

    // Step 22: white curve (7,7) -> (8.05,4.025), where the dot meets the r=9 circle
    if (at(22)) shape(s22(), WHITE);

    // Step 23: fill white the leaf enclosed by the step 21 + 22 curves
    if (at(23)) shape(s23(), WHITE);

    // Step 24: smooth-blend the lower-right shapes together and into the r=9 circle
    if (at(24)) blendLowerRight(BLEND);

    return col;
}
// =====================================================================
// === END DRAWING STEPS ===============================================
// =====================================================================

// =====================================================================
// === REFLECTIONS =====================================================
// The display reflects the triangle across its sides. Each fold stage
// adds one line ("// Fold k:" tags are shown in the animation).
// Mirror lines in the end: x = 16k, y = 16k and the diagonals x +- y = 16 * odd.
// =====================================================================
vec2 fold(vec2 p, int stage) {
    if (stage >= 3) p -= 32.0 * floor(p / 32.0 + 0.5);        // Fold 3: repeat every 32 units
    if (stage >= 1) p.x = abs(p.x);                           // Fold 1: mirror across the left edge
    if (stage >= 2) p.y = abs(p.y);                           // Fold 2: mirror across the bottom edge
    if (stage >= 3 && p.x + p.y > 16.0) p = 16.0 - p.yx;      // Fold 3: mirror across the slanted edge
    return p;
}

// Area covered after each fold stage: triangle, big triangle, diamond, everything.
// (Only outer edges are anti-aliased; mirror lines inside stay seamless.)
float foldArea(vec2 p, int stage) {
    if (stage <= 0) return fill(sdTriangle(p, A, B, C));
    if (stage == 1) return fill(sdTriangle(p, vec2(-B.x, B.y), B, C));
    if (stage == 2) return fill((abs(p.x) + abs(p.y) - 16.0) * 0.70710678);
    return 1.0;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    if (u_edit) {
        // Editing view: the single base triangle on the grid.
        // pixel -> grid units, (0,0) bottom-left of the 16x16 square
        vec2 p = uv * (GRID + 2.0 * MARGIN) - MARGIN;
        PX = (GRID + 2.0 * MARGIN) / u_resolution.y;

        vec3 base = background(p);
        float dBox = max(abs(p.x - 8.0), abs(p.y - 8.0)) - 8.0;            // outer 16x16 border
        base = paint(base, vec3(0.35, 0.34, 0.32), stroke(dBox, 0.08));

        // Step 0: right triangle A(0,0) B(16,0) C(0,16), right angle at A (guide; editing view only)
        if (u_step >= 0) {
            float d = sdTriangle(p, A, B, C);
            base = paint(base, vec3(0.20, 0.45, 0.85), 0.18 * fill(d));   // soft fill
            base = paint(base, vec3(0.10, 0.25, 0.60), stroke(d, 0.12));  // outline
        }

        vec3 c = pattern(p, base, fill(sdTriangle(p, A, B, C)));

        // hover marker at the nearest grid point
        vec2 m = floor(u_mouse + 0.5);
        c = paint(c, vec3(0.90, 0.30, 0.15), stroke(sdCircle(p, m, 0.22), 0.07));
        outColor = vec4(c, 1.0);
    } else {
        // Display view: the base triangle folded u_fold times, shown in the
        // world window u_viewMin .. u_viewMin + u_viewSize.
        vec2 p = u_viewMin + uv * u_viewSize;
        PX = u_viewSize.y / u_resolution.y;

        // No clip inside pattern(): mirror lines must not get anti-aliased edges.
        // Dark grey base so the empty triangle is visible until step 12 fills it.
        vec3 c = pattern(fold(p, u_fold), u_step >= 12 ? BLACK : vec3(0.22), 1.0);
        float a = mix(foldArea(p, u_fold - 1), foldArea(p, u_fold), u_fold > 0 ? u_foldFade : 1.0);
        outColor = vec4(c * a, a);                                          // premultiplied alpha
    }
}
