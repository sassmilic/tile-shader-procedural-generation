#version 300 es
precision highp float;
uniform vec2 u_resolution;
out vec4 o;

// The tile as data: painted in order onto a black triangle, one shape per line.
// circle (x, y, ±r, 0)   rectangle (x, y, ±half width, half height)
// square turned 45° (x, y, ±half diagonal, -1)                         + white, - black
const vec4 S[19] = vec4[](
    vec4( 8.2, 5.55, 1.87, 0),   // leaf
    vec4( 6.25, 5., -2.1,  0),   // its black inner edge -> tip at (7,7)
    vec4(11.2, 4.,   0.8,  2),   // tall bar
    vec4(10.7, 2.,   1.,   0),   // dot
    vec4(10.5, 3.5, -0.8,  0),   // notch
    vec4(12.,  0.,   1.,  2.5),  // square
    vec4(14.,  0.,   0.5,  1),   // small bar
    vec4(11.3, 0.8, -0.4,  0),   // notch
    vec4(11.,  0.25, 0.3,  0),   // dot
    vec4( 0.,  0.,   9.,   0),   // bullseye
    vec4( 0.,  0.,  -6.,   0),
    vec4( 0.,  0.,   3.,   0),
    vec4( 0., 16., -10.,  -1),   // flower: square background, tips at the bullseyes
    vec4( 5.5, 8.75, 2.5, .25),  // stripe
    vec4( 0., 16.,   4.5,  0),   // flower: centre
    vec4( 0., 11.,   2.,   0),   //         petal
    vec4( 4., 12.,   2.25, 0),   //         petal
    vec4( 0., 16.,  -3.,   0),   //         ring
    vec4( 0., 16.,   2.,   0));

void main() {
    float px = 64. / u_resolution.y;
    vec2 p = gl_FragCoord.xy * px - 32.;              // window: 64 x 64 grid units
    p = abs(mod(p + 16., 32.) - 16.);                 // mirror lines x, y = 16k
    p = p.x + p.y > 16. ? 16. - p.yx : p;             // mirror across the slanted edge
    float c = 0.;
    for (int i = 0; i < S.length(); i++) {
        vec2 q = abs(p - S[i].xy);
        float r = abs(S[i].z), d = S[i].w == 0. ? length(q) - r
                                 : S[i].w > 0. ? max(q.x - r, q.y - S[i].w) : (q.x + q.y - r) * .7071;
        c = mix(c, step(0., S[i].z), clamp(.5 - d / px, 0., 1.));
    }
    o = vec4(vec3(c), 1);
}
