vec2 tile(vec2 p) { p = abs(mod(p + 16., 32.) - 16.); return p.x + p.y > 16. ? 16. - p.yx : p; }

vec2 p; float D = 1e9, glow = 3.1, melt = 0.;
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.); return min(a, b) - h * h / (4. * k + 1e-9); }
void add(float d) { D = smin(D, d, melt); }
void cut(float d) { D = -smin(-D, d, melt); }
float circle(float x, float y, float r) { return length(p - vec2(x, y)) - r; }
float rect(float x, float y, float w, float h) { vec2 e = abs(p - vec2(x, y)) - vec2(w, h); return length(max(e, 0.)) + min(max(e.x, e.y), 0.); }
float tri(float a, float b, float h) { return max(max(-p.y, p.x - b), dot(p - vec2(a, 0.), normalize(vec2(-h, b - a)))); }

void mainImage(out vec4 o, vec2 u) {
    p = tile(u * 64. / iResolution.y - 32.);
    add(circle(-2.3, 6., 8.8));
    cut(circle(-1.8, -.1, 11.2));
    add(abs(circle(0., 0., 7.5)) - 1.5);
    add(rect(8.25, 4., .25, 4.));
    cut(tri(6., 9.5, 4.2));
    add(rect(9.25, 4., .25, 4.));
    add(tri(7., 9.5, 3.3));
    cut(tri(8., 9.5, 2.));
    add(circle(0., 0., 3.));
    add(circle(13., -4.1, 5.8));
    add(circle(18.3, 6.5, 8.));
    add(circle(4.65, 9.25, 1.05));
    cut(circle(3.4, 10.05, .5));
    add(circle(2.1, 10.7, 1.));
    cut(circle(.8, 10.95, .4));
    add(circle(.25, 10.85, .3));
    cut(rect(3.25, 12.5, .75, .5));
    cut(rect(1.5, 13.25, 1.5, .25));
    cut(abs(circle(16., 0., 1.25)) - .25);
    o = vec4(vec3(exp(-max(D, 0.) * glow)), 1);
}
