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

// ---------- shared shapes used by several steps ----------

// The petal curve: step 7 (0,9)->(1.7,12) then step 8 (1.7,12)->(5.5,10.5).
// Returns signed distance, < 0 below the curve. For x > 5.5 (between the
// curve's end and the slanted edge) everything counts as below.
float sdBelowPetalCurve(vec2 p) {
    vec2 c0 = vec2(0.0, 9.0), c1 = vec2(1.7, 9.0), c2 = vec2(1.7, 12.0);   // step 7
    vec2 e1 = vec2(2.9, 9.4), e2 = vec2(5.5, 10.5);                        // step 8 (starts at c2)
    float dCurve = min(sdBezier(p, c0, c1, c2), sdBezier(p, c2, e1, e2));
    float yCurve = p.x < c2.x ? bezierYatX(c0, c1, c2, p.x)
                 : p.x < e2.x ? bezierYatX(c2, e1, e2, p.x)
                 : 1e3;
    return p.y < yCurve ? -dCurve : dCurve;
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

    col = background(p);
    covered = 0.0;

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
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 2: circle at A(0,0), r=6, filled black
    if (u_step >= 2) {
        float d = sdCircle(p, A, 6.0);
        draw(vec3(0.0), fill(d) * inTri);
    }

    // Step 3: circle at A(0,0), r=3, filled white
    if (u_step >= 3) {
        float d = sdCircle(p, A, 3.0);
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 4: circle at C(0,16), r=3, filled black
    if (u_step >= 4) {
        float d = sdCircle(p, C, 3.0);
        draw(vec3(0.0), fill(d) * inTri);
    }

    // Step 5: circle at C(0,16), r=2, filled white
    if (u_step >= 5) {
        float d = sdCircle(p, C, 2.0);
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 6: black line (3,8.5) -> (7.5,8.5), width 0.15
    if (u_step >= 6) {
        float d = sdSegment(p, vec2(3.0, 8.5), vec2(7.5, 8.5));
        draw(vec3(0.0), stroke(d, 0.15) * inTri);
    }

    // Step 7: black curve (0,9) -> (1.7,12), leaves flat, arrives vertical (Bezier ctrl (1.7,9)), width 0.15
    if (u_step >= 7) {
        float d = sdBezier(p, vec2(0.0, 9.0), vec2(1.7, 9.0), vec2(1.7, 12.0));
        draw(vec3(0.0), stroke(d, 0.15) * inTri);
    }

    // Step 8: black curve (1.7,12) -> (5.5,10.5), bulges to lower-left like a petal (Bezier ctrl (2.9,9.4)), width 0.15
    if (u_step >= 8) {
        float d = sdBezier(p, vec2(1.7, 12.0), vec2(2.9, 9.4), vec2(5.5, 10.5));
        draw(vec3(0.0), stroke(d, 0.15) * inTri);
    }

    // Step 9: fill black between the step 6 line (below) and the step 7+8 curve (above)
    if (u_step >= 9) {
        // Above the step 6 line. The line is concave (rises, then flat), so the
        // region above it is the union of the regions above its two segments.
        vec2 l0 = vec2(0.0, 6.0), l1 = vec2(3.0, 8.5), l2 = vec2(7.5, 8.5);
        vec2 n1 = normalize(vec2(l1.y - l0.y, l0.x - l1.x));   // points below segment 1
        vec2 n2 = normalize(vec2(l2.y - l1.y, l1.x - l2.x));   // points below segment 2
        float dAbove = min(dot(p - l0, n1), dot(p - l1, n2)); // < 0 above the line

        float d = max(dAbove, sdBelowPetalCurve(p));
        draw(vec3(0.0), fill(d) * inTri);
    }

    // Step 10: fill the two petals white (above the step 7+8 curve, outside the C(0,16) r=3 circle)
    if (u_step >= 10) {
        float d = max(-sdBelowPetalCurve(p), -sdCircle(p, C, 3.0));
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 11: polygon (0,6) (3,8.5) (7.5,8.5) (7,9) (2.5,9), filled white
    if (u_step >= 11) {
        vec2 v[MAX_POLY];
        v[0] = vec2(0.0, 6.0);
        v[1] = vec2(3.0, 8.5);
        v[2] = vec2(7.5, 8.5);
        v[3] = vec2(7.0, 9.0);
        v[4] = vec2(2.5, 9.0);
        // grown by half a pixel to cover step 9's anti-aliased edge on the shared (0,6)-(3,8.5) side
        float d = sdPolygon(p, v, 5) - 0.5 * PX;
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 12: fill all still-unfilled space in the triangle black
    if (u_step >= 12) {
        // smoothstep: where two shapes meet edge-to-edge each covers ~50%,
        // so treat >= 50% as fully covered to avoid a dark seam.
        draw(vec3(0.0), (1.0 - smoothstep(0.0, 0.5, covered)) * inTri);
    }

    // Step 13: circle at (9,4.5), r=1, filled white
    if (u_step >= 13) {
        float d = sdCircle(p, vec2(9.0, 4.5), 1.0);
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 14: circle at (10.7,2), r=1, filled white
    if (u_step >= 14) {
        float d = sdCircle(p, vec2(10.7, 2.0), 1.0);
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 15: polygon (13.5,0) (14.5,0) (14.5,1) (13.5,2), filled white
    if (u_step >= 15) {
        vec2 v[MAX_POLY];
        v[0] = vec2(13.5, 0.0);
        v[1] = vec2(14.5, 0.0);
        v[2] = vec2(14.5, 1.0);
        v[3] = vec2(13.5, 2.0);
        float d = sdPolygon(p, v, 4);
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 16: rectangle (11,0) to (13,2.5), filled white
    if (u_step >= 16) {
        vec2 lo = vec2(11.0, 0.0), hi = vec2(13.0, 2.5);
        vec2 q = abs(p - 0.5 * (lo + hi)) - 0.5 * (hi - lo);
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        draw(vec3(1.0), fill(d) * inTri);
    }

    // Step 17: circle at (11.3,0.8), r=0.4, filled black
    if (u_step >= 17) {
        float d = sdCircle(p, vec2(11.3, 0.8), 0.4);
        draw(vec3(0.0), fill(d) * inTri);
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
