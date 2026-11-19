# Tile shader sandbox

A live GLSL (WebGL2) sandbox for building a tile pattern on a 16×16 grid, one step at a time.

```
node serve.js        # then open http://localhost:5173
```

Saving `shader.frag` recompiles the shader in the browser right away, with no page reload. Compile errors appear at the bottom of the page, and the last working version keeps rendering.

## Coordinates
- Points are `(x, y)` in grid units from 0 to 16, with `(0,0)` at the bottom-left and `(16,16)` at the top-right.
- The base shape is the right triangle **A(0,0)**, **B(16,0)**, **C(0,16)**, with the right angle at A.
- Hover over the grid to see the nearest grid point in the status bar.

## Files
- `shader.frag`: the pattern. Each drawing instruction is a numbered step inside the `DRAWING STEPS` section. Available helpers: `sdCircle`, `sdSegment`, `sdTriangle`, `fill`, `stroke`, `paint`.
- `main.js`: the WebGL host, axis and point labels (`LABELS`), mouse readout and live reload.
- `serve.js`: a static server with no dependencies, plus file-change events.
