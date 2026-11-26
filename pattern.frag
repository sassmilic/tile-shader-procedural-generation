vec2 p; float D = 1e9, melt;
float smin(float a, float b) { float h = max(melt - abs(a - b), 0.); return min(a, b) - h * h / (4. * melt + 1e-9); }
void add(float d) { D = smin(D, d); }
void cut(float d) { D = -smin(-D, d); }
float circle(float x, float y, float r) { return length(p - vec2(x, y)) - r; }
float rect(float x, float y, float w, float h) { vec2 e = abs(p - vec2(x, y)) - vec2(w, h); return length(max(e, 0.)) + min(max(e.x, e.y), 0.); }
float tri(float a, float h) { return max(max(-p.y, p.x - 9.5), dot(p - vec2(a, 0.), normalize(vec2(-h, 9.5 - a)))); }

void mainImage(out vec4 o, vec2 u) {
    float c = floor(iTime * .5), r = fract(c * .618), t = iTime - c * 2. - .5 - r;
    melt = (.25 + r / 2.) * exp(-40. * t * t);
    p = abs(mod(u * 64. / iResolution.y - 16., 32.) - 16.);
    p = min(p, 16. + .4 * sin(iTime * .5) - p.yx);
    add(circle(-2.3, 6., 8.8));
    cut(circle(-1.8, -.1, 11.2));
    add(abs(abs(circle(0., 0., 4.5 + melt / 5.)) - 3.) - 1.5);
    add(rect(8.25, 4., .25, 4.));
    cut(tri(6., 4.2));
    add(rect(9.25, 4., .25, 4.));
    add(tri(7., 3.3));
    cut(tri(8., 2.));
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
    o = vec4(vec3(exp(-(7.5 - 4.5 * cos(iTime * 3.14)) * max(D, 0.))), 1);
}
