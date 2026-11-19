#version 300 es
precision highp float;

// Animation template for test.frag: animate.js replaces the SHAPES line
// below with test.frag's shape table, so test.frag stays the single source.
uniform vec2 u_resolution;
uniform int u_n;              // number of shapes drawn
uniform float u_fade;         // fade-in (0..1) of the last drawn shape
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
    float c = 0.;                                              // black triangle
    for (int i = 0; i < S.length(); i++) {
        if (i >= u_n) break;
        vec2 q = abs(p - S[i].xy);
        float r = abs(S[i].z), d = S[i].w == 0. ? length(q) - r
                                 : S[i].w > 0. ? max(q.x - r, q.y - S[i].w) : (q.x + q.y - r) * .7071;
        float f = i == u_n - 1 ? u_fade : 1.;
        c = mix(c, step(0., S[i].z), clamp(.5 - d / px, 0., 1.) * f);
    }
    o = vec4(vec3(c) * a, a);                                  // premultiplied alpha
}
