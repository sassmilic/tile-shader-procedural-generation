# Tile shader sandbox

A live GLSL (WebGL2) sandbox for building a tile pattern on a 16×16 grid, one step at a time.

```
node serve.js        # then open http://localhost:5173
```

- **Display view** (`/`): the finished pattern. The base triangle is reflected across all its sides, again and again, so it tiles the whole plane like a kaleidoscope.
- **Editing view** (`/?edit`, or press **E**): black graph paper zoomed out so every shape is seen whole (the window is `EDIT_MIN`/`EDIT_MAX` in `main.js`, widened whenever a shape reaches past it). The triangle is outlined, and everything outside it is dimmed, because only the triangle gets tiled. It also has axis numbers, corner labels, a hover readout, and a clickable step list that replays the drawing up to any step.
- **Build animation** (`/animate.html`): writes `test.frag`'s program piece by piece. At every moment the panel shows a complete, valid shader, and that exact text is what's drawing (its numbers go to the GPU as uniforms).
  - It starts on a black sheet zoomed out to show every shape whole. A shape or painting function (`circle`, `rect`, `tri`, `add`, `cut`) is written the first time it's needed; after that, each shape is a single call line. A bytes and lines counter shows what each step costs.
  - Once every shape is drawn, the cut is typed (the `discard` line), and only the triangle is kept. The view doesn't move: the reflections spread the tiling out around the triangle where it stands. The cut is removed again at the last reflection: from then on `tile()` folds every point into the triangle, so it can never fire.
  - Next come the reflections, typed into `tile()`, and then the glow: `glow = 3.1` is added to the declaration line (`vec2 p; float D = 1e9, glow = 3.1;`) and the output becomes `exp(-max(D, 0.) * glow)`, with the number gliding down from sharp edges to its value.
  - After that it runs forever: every 2.2 seconds 2–4 random numbers turn pink and glide to new values, and the tiling follows. The glow (1.25–5) is one of them. Zooming keeps the mosaic between 4×4 and 8×8 tiles.
  - **Questions** (the `?????????` button above the code, shown once the code is fully written): the text comes from `questions.md`, and saving that file updates the panel without restarting the animation. Write `# Title`, then a paragraph for the subtitle, `## Section` headings, `1. …` lines for questions (an indented line under a question becomes its explanation, shown in a box), and `[^label]: …` lines for notes (indent a line to continue a note). Use `[^label]` to point to a note, plus `*italic*` and `[text](url)`.
  - ◀◀ ▶ ■ rewind, play and stop. `?t=…` freezes at a time, and `?seed=…` repeats the same mutations.

- **Test bed** (`/test.html`): the tile from `shader.frag` next to `test.frag`, which redraws it with circles, rectangles and triangles. There's one call per shape, such as `add(circle(0., 0., 3.))` (a shape added to the white) or `cut(tri(6., 9.5, 4.2))` (cut out of it), painted in order into one distance field, plus the one-line tiling `tile()`. A ring is one call too: `add(abs(circle(0., 0., 7.5)) - 1.5)`. It draws the same picture as the editing view's steps in fewer calls (19 instead of 21), because each of the two ring pairs, at A and at B, is one call. The black glows softly near white edges, because the output fades with the distance `D`. `test.frag` is a Shadertoy-style program (`mainImage`, `iResolution`), so it can be pasted straight into shadertoy.com; `wrapShadertoy()` in `renderer.js` runs it here. The page shows the full source and live line counts.

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
- **Painters:** `shape` fills, `line` strokes at 0.15 wide. A white shape is merged into one shared distance field and a black shape is cut out of it.
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
