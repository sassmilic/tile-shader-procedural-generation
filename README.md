# Tile shader sandbox

A live GLSL (WebGL2) sandbox for building a tile pattern on a 16×16 grid, one step at a time.

```
node serve.js        # then open http://localhost:5173
```

- **Display view** (`/`): the finished pattern. The base triangle is reflected across all its sides, again and again, so it tiles the whole plane like a kaleidoscope.
- **Editing view** (`/?edit`, or press **E**): black graph paper zoomed out so every shape is seen whole (the window is `EDIT_MIN`/`EDIT_MAX` in `main.js`, widened whenever a shape reaches past it). The triangle is outlined, and everything outside it is dimmed, because only the triangle gets tiled. It also has axis numbers, corner labels, a hover readout, and a clickable step list that replays the drawing up to any step.
- **Build animation** (`/animate.html`): writes `test.frag`'s program piece by piece. At every moment the panel shows a complete, valid shader, and that exact text is what's drawing (its numbers go to the GPU as uniforms).
  - A shape or colour function (`circle`, `rect`, `diamond`, `white`, `black`) is written the first time it's needed; after that, each shape is a single call line. A bytes and lines counter shows what each step costs.
  - Next come the reflections, typed into `tile()`, and then the glow: a `float glow = 4.;` parameter is typed and the output becomes `exp(-max(D, 0.) * glow)`, with the number gliding down from sharp edges to its value.
  - Then the colour: `float hue = 0.;` and `float sat = 0.;` are typed, with a one-line `col()` function, and the output becomes `mix(col(0.), col(.5), …)`. With `sat = 0.` the two colours are black and white, so the picture doesn't change yet.
  - After that it runs forever: random numbers turn pink and glide to new values, and the tiling follows. The glow is one of them. Now and then the hue drifts round the colour wheel, or the saturation changes (sometimes back to 0, black and white). Zooming keeps the mosaic between 4×4 and 13×13 tiles.
  - **Questions** (button at the top right, shown once the code is fully written): the text comes from `questions.md`, and saving that file updates the panel without restarting the animation. Write `# Title`, then a paragraph for the subtitle, `## Section` headings, `1. …` lines for questions, and `[^label]: …` lines for notes (indent a line to continue a note). Use `[^label]` to point to a note, plus `*italic*` and `[text](url)`.
  - ◀◀ ▶ ■ rewind, play and stop. `?t=…` freezes at a time, and `?seed=…` repeats the same mutations.

- **Test bed** (`/test.html`): the original next to `test.frag`, which redraws the tile with only circles and rectangles (a black circle of radius 99 serves as a straight edge). There's one call per shape, such as `white(circle(0., 0., 9.))`, painted in order into one distance field, plus the two-line tiling. The black glows softly near white edges, because the output fades with the distance `D`. `test.frag` is a Shadertoy-style program (`mainImage`, `iResolution`), so it can be pasted straight into shadertoy.com; `wrapShadertoy()` in `renderer.js` runs it here. The page shows the full source and live line counts.

Saving `shader.frag` recompiles the shader on every open page right away, with no page reload. Compile errors appear on the page, and the last working version keeps rendering.

## Coordinates
- Points are `(x, y)` in grid units from 0 to 16, with `(0,0)` at the bottom-left and `(16,16)` at the top-right.
- The base shape is the right triangle **A(0,0)**, **B(16,0)**, **C(0,16)**, with the right angle at A.

## Steps
Each drawing step in `shader.frag` is a `// Step N: description` comment followed by **one line**:

```glsl
// Step 1: circle at (-2.3,6), r=8.8, filled white
if (at(1)) shape(circle(v(-2.3, 6.0), 8.8), WHITE);
```

The step language, defined just above `pattern()`:
- **Shapes:** `circle`, `tri`, `box`, `segment`, `curve` (a quadratic Bézier), `poly4`, `poly5`, `thick`. Each is a signed distance from the current point `P`.
- **Painters:** `shape` fills, `line` strokes at 0.15 wide, `fillRest` fills whatever is still empty.
- **Gate:** `at(N)` decides whether step N is drawn and fades it in while it's being animated.
- **Points and colours:** `v(x, y)`, `A`, `B`, `C`, `WHITE`, `BLACK`.

Shapes are drawn whole, and the sheet starts black. Only what lands inside triangle ABC is tiled.

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
