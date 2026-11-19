#version 300 es
precision highp float;

// Animation template for test.frag: animate.js replaces the SHAPES line
// below with test.frag's shapes section (table, smin, shapes()), so
// test.frag stays the single source.
uniform vec2 u_resolution;
uniform int u_n;              // number of shapes drawn
uniform float u_fade;         // fade-in (0..1) of the last drawn shape
uniform float u_blend;        // smoothing strength (0 = hard edges, test.frag's BLEND = done)
uniform int u_fold;           // reflection stage 0..4 (4 = full tiling, as in test.frag)
uniform vec2 u_viewMin;       // world window (grid units)
uniform vec2 u_viewSize;
out vec4 o;

//SHAPES

// Reflections, built up a stage at a time; stage 4 is test.frag's two lines.
vec2 fold(vec2 p, int stage) {
    if (stage == 1) p.x = abs(p.x);                           // Fold 1: mirror across the left edge
    if (stage == 2 || stage == 3) p = abs(p);                 // Fold 2: mirror across the bottom edge too
    if (stage >= 4) p = abs(mod(p + 16., 32.) - 16.);         // Fold 4: repeat the mirrors every 16 units
    if (stage >= 3) p = p.x + p.y > 16. ? 16. - p.yx : p;     // Fold 3: mirror across the slanted edge
    return p;
}

// Signed distance to the area covered after each stage: triangle, big
// triangle, diamond, 32x32 square, everything.
float area(vec2 p, int stage) {
    if (stage == 0) return max(max(-p.x, -p.y), (p.x + p.y - 16.) * .7071);
    if (stage == 1) return max(-p.y, (abs(p.x) + p.y - 16.) * .7071);
    if (stage == 2) return (abs(p.x) + abs(p.y) - 16.) * .7071;
    if (stage == 3) return max(abs(p.x), abs(p.y)) - 16.;
    return -1.;
}

void main() {
    float px = u_viewSize.y / u_resolution.y;
    vec2 p = u_viewMin + gl_FragCoord.xy / u_resolution * u_viewSize;
    float a = clamp(.5 - area(p, u_fold) / px, 0., 1.);
    p = fold(p, u_fold);
    // the first u_n shapes, the newest one fading in over the ones before it
    float before = clamp(.5 - shapes(p, max(u_n - 1, 0), u_blend) / px, 0., 1.);
    float now    = clamp(.5 - shapes(p, u_n, u_blend) / px, 0., 1.);
    float c = mix(before, now, u_fade);
    o = vec4(vec3(c) * a, a);                                  // premultiplied alpha
}
