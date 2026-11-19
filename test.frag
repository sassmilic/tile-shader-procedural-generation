#version 300 es
precision highp float;
uniform vec2 u_resolution;
out vec4 o;

vec2 tile(vec2 p) {
    p = abs(mod(p + 16., 32.) - 16.);
    p = p.x + p.y > 16. ? 16. - p.yx : p;
    return p;
}

float D = 1e9;
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.) / max(k, 1e-6); return min(a, b) - h * h * k * .25; }
void white(float d) { D = min(D, d); }
void black(float d) { D = max(D, -d); }
void white(float d, float k) { D = smin(D, d, k); }
void black(float d, float k) { D = -smin(-D, d, k); }
float circle(vec2 p, float x, float y, float r) { return length(p - vec2(x, y)) - r; }
float rect(vec2 p, float x, float y, float w, float h) { vec2 e = abs(p - vec2(x, y)) - vec2(w, h); return length(max(e, 0.)) + min(max(e.x, e.y), 0.); }
float diamond(vec2 p, float x, float y, float r) { vec2 q = abs(p - vec2(x, y)); return (q.x + q.y - r) * .7071; }
const float BLEND = .3;

void main() {
    float px = 64. / u_resolution.y;
    vec2 p = gl_FragCoord.xy * px - 32.;
    p = tile(p);
    if (p.x < 0. || p.y < 0. || p.x + p.y > 16.) discard;
    white(circle(p, 8.2, 5.55, 1.87));
    black(circle(p, 6.25, 5., 2.1));
    white(rect(p, 11.2, 4., .8, 2.), BLEND);
    white(circle(p, 10.7, 2., 1.), BLEND);
    black(circle(p, 10.5, 3.5, .8), BLEND);
    white(rect(p, 12., 0., 1., 2.5), BLEND);
    white(rect(p, 14., 0., .5, 1.), BLEND);
    black(circle(p, 11.3, .8, .4), BLEND);
    white(circle(p, 11., .25, .3), BLEND);
    white(circle(p, 0., 0., 9.), BLEND);
    black(circle(p, 0., 0., 6.));
    white(circle(p, 0., 0., 3.));
    black(diamond(p, 0., 16., 10.));
    white(rect(p, 5.5, 8.75, 2.5, .25));
    white(circle(p, 0., 16., 4.5));
    white(circle(p, 0., 11., 2.));
    white(circle(p, 4., 12., 2.25));
    black(circle(p, 0., 16., 3.));
    white(circle(p, 0., 16., 2.));
    o = vec4(vec3(clamp(.5 - D / px, 0., 1.)), 1);
}
