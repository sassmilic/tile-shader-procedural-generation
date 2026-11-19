#version 300 es
precision highp float;
uniform vec2 u_resolution;
out vec4 o;

//--- shapes (animate.frag reuses everything down to "end shapes")
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
const float BLEND = .3;          // shapes 3-10 melt into what is under them

float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.) / max(k, 1e-6); return min(a, b) - h * h * k * .25; }

// Painting in black and white is one distance field D (< 0 is white):
// a white shape is a union, a black one a cut; smooth ones for shapes 3-10.
float shapes(vec2 p, int n, float blend) {
    float D = 1e9;
    for (int i = 0; i < n; i++) {
        vec2 q = abs(p - S[i].xy), e = q - vec2(abs(S[i].z), S[i].w);
        float d = S[i].w == 0. ? length(q) - abs(S[i].z)
                : S[i].w > 0. ? length(max(e, 0.)) + min(max(e.x, e.y), 0.) : (q.x + q.y - abs(S[i].z)) * .7071;
        float k = i > 1 && i < 10 ? blend : 0.;
        D = S[i].z > 0. ? smin(D, d, k) : -smin(-D, d, k);
    }
    return D;
}
//--- end shapes

void main() {
    float px = 64. / u_resolution.y;
    vec2 p = gl_FragCoord.xy * px - 32.;              // window: 64 x 64 grid units
    p = abs(mod(p + 16., 32.) - 16.);                 // mirror lines x, y = 16k
    p = p.x + p.y > 16. ? 16. - p.yx : p;             // mirror across the slanted edge
    o = vec4(vec3(clamp(.5 - shapes(p, S.length(), BLEND) / px, 0., 1.)), 1);
}
