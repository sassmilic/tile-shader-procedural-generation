# Tile shader sandbox

A live GLSL (WebGL2) sandbox for building a tile pattern on a 16×16 grid, one step at a time.

```
node serve.js        # then open http://localhost:5173
```

- **Display view** (`/`): the finished pattern. The base triangle is reflected across all its sides, again and again, so it tiles the whole plane like a kaleidoscope.
- **Editing view** (`/?edit`, or press **E**): the single triangle on the grid, with axis numbers, corner labels, a hover readout and a clickable step list that replays the drawing up to any step.
- **Build animation** (`/animate.html`): plays every step and then the three reflections, showing each step's one line of shader code next to it. Use Space to play or pause, ← → to move between steps, and the scrubber to jump. `?t=12.5` freezes the animation at that time.

- **Test bed** (`/test.html`): the original next to `test.frag`, which redraws the tile with only circles and rectangles. It's a table of 19 `vec4`s, one per shape (`(x, y, ±r, 0)` is a circle, `(x, y, ±w, h)` a rectangle; the sign is the colour), painted in order by one loop, plus the two-line tiling. The page shows its full source and live line counts.

Saving `shader.frag` recompiles the shader on every open page right away, with no page reload. Compile errors appear on the page, and the last working version keeps rendering.

## Coordinates
- Points are `(x, y)` in grid units from 0 to 16, with `(0,0)` at the bottom-left and `(16,16)` at the top-right.
- The base shape is the right triangle **A(0,0)**, **B(16,0)**, **C(0,16)**, with the right angle at A.

## Steps
Each drawing step in `shader.frag` is a `// Step N: description` comment followed by **one line**:

```glsl
// Step 1: circle at A(0,0), r=9, filled white
if (at(1)) shape(circle(A, 9.0), WHITE);
```

The step language, defined just above `pattern()`:
- **Shapes:** `circle`, `box`, `segment`, `curve` (a quadratic Bézier), `poly4`, `poly5`, `thick`. Each is a signed distance from the current point `P`.
- **Painters:** `shape` fills, `line` strokes at 0.15 wide, `fillRest` fills whatever is still empty.
- **Gate:** `at(N)` decides whether step N is drawn and fades it in while it's being animated.
- **Points and colours:** `v(x, y)`, `A`, `B`, `C`, `WHITE`, `BLACK`.

**Rule:** nothing is ever drawn outside triangle ABC. The painters clip to it.

## Tiling in two lines
To tile, map every point back into triangle ABC by reflection:

```glsl
p = abs(mod(p + 16.0, 32.0) - 16.0);       // mirror lines x = 16k, y = 16k
p = p.x + p.y > 16.0 ? 16.0 - p.yx : p;    // mirror across the slanted edge
```

The first line folds the plane into one 16×16 square, and the second folds that square onto the triangle. There are no loops, and every pixel costs the same. `fold(p, stage)` builds this up one line at a time: mirror across the left edge, then the bottom edge too, then the slanted edge (giving a 32×32 square tile), then repeat everywhere. The animation types those lines out and shows each new area as soon as its line is complete.

## Files
- `shader.frag`: the pattern, its steps and the reflections.
- `renderer.js`: a minimal WebGL2 full-screen shader renderer (uniforms set by name), plus the `// Step` parser.
- `main.js` and `index.html`: the display and editing views.
- `animate.js` and `animate.html`: the build animation. Its timeline and code panel are read live from `shader.frag`.
- `serve.js`: a static server with no dependencies, plus file-change events for live reload.
