vec2 tile(vec2 p) {
    p = abs(mod(p + 16., 32.) - 16.);
    p = p.x + p.y > 16. ? 16. - p.yx : p;
    return p;
}

vec2 p;
float D = 1e9;
void white(float d) { D = min(D, d); }
void black(float d) { D = max(D, -d); }
float circle(float x, float y, float r) { return length(p - vec2(x, y)) - r; }
float rect(float x, float y, float w, float h) { vec2 e = abs(p - vec2(x, y)) - vec2(w, h); return length(max(e, 0.)) + min(max(e.x, e.y), 0.); }

void mainImage(out vec4 o, vec2 u) {
    float px = 64. / iResolution.y;
    p = tile(u * px - 32.);
    if (p.x < 0. || p.y < 0. || p.x + p.y > 16.) discard;
    white(circle(8.2, 5.55, 1.87));
    black(circle(6.25, 5., 2.1));
    white(rect(11.2, 4., .8, 2.));
    white(circle(10.7, 2., 1.));
    black(circle(10.5, 3.5, .8));
    white(rect(12., 0., 1., 2.5));
    white(rect(14., 0., .5, 1.));
    black(circle(11.3, .8, .4));
    white(circle(11., .25, .3));
    white(circle(0., 0., 9.));
    black(circle(0., 0., 6.));
    white(circle(0., 0., 3.));
    black(circle(-70., 76., 99.));
    white(rect(5.5, 8.75, 2.5, .25));
    white(circle(0., 16., 4.5));
    white(circle(0., 11., 2.));
    white(circle(4., 12., 2.25));
    black(circle(0., 16., 3.));
    white(circle(0., 16., 2.));
    o = vec4(vec3(exp(-max(D, 0.) * 4.)), 1);
}
