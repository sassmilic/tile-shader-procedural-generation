# Tile shader sandbox

A live GLSL (WebGL2) sandbox for building a tile pattern on a 16×16 grid, one step at a time.

```
node serve.js        # then open http://localhost:5173
```

The page opens in **display view**, which shows only the finished pattern: the triangle mirrored across its left edge A–C and then across its bottom edge A–B. The result is a diamond with corners at (±16,0) and (0,±16). The display is built from the same `pattern()` function, so edits to the steps show up on both halves. Press **E**, or open `?edit`, to switch to the **editing view**, which adds the grid, axis numbers, corner labels, hover readout and step list. Press E again to go back.

Saving `shader.frag` recompiles the shader in the browser right away, with no page reload. Compile errors appear at the bottom of the page, and the last working version keeps rendering.

## Coordinates
- Points are `(x, y)` in grid units from 0 to 16, with `(0,0)` at the bottom-left and `(16,16)` at the top-right.
- The base shape is the right triangle **A(0,0)**, **B(16,0)**, **C(0,16)**, with the right angle at A.
- Hover over the grid to see the nearest grid point in the status bar.

## Steps
Each drawing instruction is a block in `shader.frag` that starts with a `// Step N: description` comment and is wrapped in `if (u_step >= N) { ... }`. The page reads those comments to build the numbered list on the right. Click a step to see the drawing up to that point, and click it again to show everything.

**Rule:** nothing is ever drawn outside triangle ABC. Every step multiplies its coverage by the `inTri` mask.

## Files
- `shader.frag`: the pattern. Each drawing instruction is a numbered step inside the `DRAWING STEPS` section. Available helpers: `sdCircle`, `sdSegment`, `sdTriangle`, `fill`, `stroke`, `paint`.
- `main.js`: the WebGL host, axis and point labels (`LABELS`), mouse readout and live reload.
- `serve.js`: a static server with no dependencies, plus file-change events.
