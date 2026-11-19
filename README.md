# Tile shader sandbox

A live GLSL (WebGL2) sandbox for building a tile pattern on a 16×16 grid, one step at a time.

```
node serve.js        # then open http://localhost:5173
```

- **Display view** (`/`): the finished pattern. The base triangle is reflected across all its sides, again and again, so it tiles the whole plane like a kaleidoscope.
- **Editing view** (`/?edit`, or press **E**): the single triangle on the grid, with axis numbers, corner labels, a hover readout and a clickable step list that replays the drawing up to any step.
- **Build animation** (`/animate.html`): plays every step and then the three reflections, showing each step's one line of shader code next to it. Use Space to play or pause, ← → to move between steps, and the scrubber to jump. `?t=12.5` freezes the animation at that time.

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

The reflections are `fold(p, stage)`, one tagged line per stage: mirror across the left edge, then the bottom edge, then repeat and mirror across the slanted edge. The mirror lines are x = 16k, y = 16k and the diagonals x ± y = 16 × odd.

## Files
- `shader.frag`: the pattern, its steps and the reflections.
- `renderer.js`: a minimal WebGL2 full-screen shader renderer (uniforms set by name), plus the `// Step` parser.
- `main.js` and `index.html`: the display and editing views.
- `animate.js` and `animate.html`: the build animation. Its timeline and code panel are read live from `shader.frag`.
- `serve.js`: a static server with no dependencies, plus file-change events for live reload.
