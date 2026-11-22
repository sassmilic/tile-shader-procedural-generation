# Tile shader sandbox

A live GLSL (WebGL2) sandbox for building a tile pattern on a 16×16 grid, one step at a time.

Live at **https://sassmilic.github.io/tile-shader-procedural-generation/** (GitHub Pages, from `main`).

```
node serve.js        # then open http://localhost:5173 (live-reloads on save)
```

- **Build animation** (`/`, `index.html`): writes `pattern.frag`'s program piece by piece. At every moment the panel shows a complete, valid shader, and that exact text is what's drawing (its numbers go to the GPU as uniforms).
  - It starts on a black sheet zoomed out to show every shape whole. A shape or painting function (`circle`, `rect`, `tri`, `add`, `cut`) is written the first time it's needed; after that, each shape is a single call line. A bytes and lines counter shows what each step costs.
  - Once every shape is drawn, the cut is typed (the `discard` line), and only the triangle is kept. The view doesn't move: the reflections spread the tiling out around the triangle where it stands. The cut is removed again at the last reflection: from then on the tiling lines fold every point into the triangle, so it can never fire.
  - Next come the reflections, typed as lines at the top of `mainImage` (mirror x, then both axes, then the diagonal, then the `mod` that repeats it everywhere), and then the glow: the output becomes `exp(-(7.5 - 4.5 * cos(iTime * 3.14)) * max(D, 0.))`, with the 7.5 gliding down from sharp edges to its value.
  - Last comes the melt: `smin()` (a smooth minimum) is typed, `add()` and `cut()` are retyped to blend through it, and two lines setting `melt` from the clock open `mainImage`. From then on the edges are crisp except for short blips (about a third of a second) where the shapes melt into one another: one blip per 2-second slot, at a different moment in each slot and with a different strength (0.25–0.75, so it is barely there), both from `r = fract(c * .618)` (golden-ratio steps, so the rhythm never quite repeats). `iTime` is Shadertoy's clock (seconds); here it starts at 0 the moment the lines are typed, so it starts crisp. The same step retypes two lines with tiny rhythms of their own: the centre ring's radius becomes `4.5 + melt / 5.`, so the ring swells by a pixel or two on every blip (a heartbeat, reusing the melt), and the diagonal mirror becomes `16. + .4 * sin(iTime * .5)`, so the kaleidoscope's slanted seam sways once every ~12.6 seconds, out of step with the 2-second pulse. The lines driven by the clock pulse pink with what they do to the picture, and show their current value as a comment after them (`// melt = 0.56`, `// r = 5.06`, `// seam = 16.40`, `// glow = 11.7`); those comments aren't counted in the bytes. The compare page draws at `iTime = 0`: no melt and no sway, so the same shapes as `shader.frag`, with the glow at its softest.
  - After that it runs forever: every 2.2 seconds 2–4 random numbers turn pink and glide to new values, and the tiling follows. The glow isn't one of them: it pulses on its own, `7.5 - 4.5 * cos(iTime * 3.14)` (3–12, lower = blurrier): blurriest at the start of every 2-second slot and crisp in its middle, where the melt's blips land (each within half a second of it). Zooming keeps the mosaic between 1×1 (one whole tile) and 8×8 tiles.
  - **Questions** (the `?????????` button above the code, shown once the code is fully written): the text comes from `questions.md`, and saving that file updates the panel without restarting the animation. Write `# Title`, then a paragraph for the subtitle, `## Section` headings, `1. …` lines for questions (an indented line under a question becomes its explanation, shown in a box), and `[^label]: …` lines for notes (indent a line to continue a note). Use `[^label]` to point to a note, plus `*italic*` and `[text](url)`.
  - ◀◀ and ▶/❚❚: rewind, and play / pause (also the space bar). When running locally (`localhost`), a third button, ⏭, skips the build and jumps straight to the finished mosaic. `?t=…` freezes at a time, and `?seed=…` repeats the same mutations.

- **Display view** (`/tile.html`): the finished pattern. The base triangle is reflected across all its sides, again and again, so it tiles the whole plane like a kaleidoscope.
- **Editing view** (`/tile.html?edit`, or press **E**): black graph paper zoomed out so every shape is seen whole (the window is `EDIT_MIN`/`EDIT_MAX` in `main.js`, widened whenever a shape reaches past it). The triangle is outlined, and everything outside it is dimmed, because only the triangle gets tiled. It also has axis numbers, corner labels, a hover readout, and a clickable step list that replays the drawing up to any step.

- **Compare** (`/compare.html`): the tile from `shader.frag` next to `pattern.frag`, which redraws it with circles, rectangles and triangles. There's one call per shape, such as `add(circle(13., -4.1, 5.8))` (a shape added to the white) or `cut(tri(6., 4.2))` (cut out of it), painted in order into one distance field, after two tiling lines. A ring is one call too: `cut(abs(circle(16., 0., 1.25)) - .25)`, and a ring with its centre disc is one call with two `abs()`: `add(abs(abs(circle(0., 0., 4.5)) - 3.) - 1.5)`. `tri(a, h)` is the triangle (a,0) (9.5,0) (9.5,h). It draws the same picture as the editing view's steps in fewer calls (18 instead of 21). The black glows softly near white edges, because the output fades with the distance `D`. `pattern.frag` is a Shadertoy-style program (`mainImage`, `iResolution`), so it can be pasted straight into shadertoy.com; `wrapShadertoy()` in `renderer.js` runs it here. The page shows the full source and live line counts.

Saving `shader.frag` recompiles the shader on every open page right away, with no page reload. Compile errors appear on the page, and the last working version keeps rendering.

## Sound (experimental, branch `sound`)
`/sound.html`: the same animation, but the code panel is replaced by sound controls, and the picture plays hyperpop (synthesized with [Tone.js](https://tonejs.github.io/), loaded from a CDN). Click to start. The mosaic and the music share a playhead backed by the audio clock. One 2-second slot is one bar at 120 BPM. The music schedules cues ahead on a timer, so it can keep playing when the mosaic skips frames.

- **Rhythm, from the clock** (starts when the melt is typed: the drop): each melt blip is a kick (its strength the velocity); the glow's crisp moment in the middle of the bar is the snare/clap; the bar line is an open hat, a bass note and a pad chord, chosen from the bar's golden-ratio `r`; the pad's filter breathes with the glow; the sway widens the pad and pans the hats; hi-hats get denser as the zoom shows more tiles, and zoom glides are risers/downlifters.
- **Shapes:** every `add`/`cut` call has its own voice (circles: supersaw stab, rects: chip, triangles: bell; switchable). Size is pitch (bigger = lower, on the scale), x is pan, y is brightness; cut shapes sit lower. In the build each shape plays as it lands. Once the beat drops, the shapes are a **step sequencer**: they take turns, one per 16th note, each at its current note. 18 shapes over 16-step bars, so the pattern drifts against the beat. When a random change moves a shape, its next notes follow, and while it's changing its turn is accented (louder, longer).
- **Controls:** levels, instruments, key and scale, kick/hat/bass/pad settings, reverb, delay, bit-crusher, chorus and sidechain. Click a channel's name to mute it. Settings are saved in the browser; *copy settings* / *paste settings* move them as JSON.
- Circles and sweeps are audible during the build, and the drums enter at the drop. Click the other channel names to bring them into the mix. Reset restores these defaults.
- The output uses a 70 Hz low cut, 14 kHz high cut, and limiter in both engine modes. Pause holds the playhead and queued notes. Rewind clears queued notes and effect tails.
- Synths only for now. Samples (`sounds/`) are kept out of git, since most sample-pack licences forbid redistributing the files.
- Testing options include `?autostart` where autoplay is allowed, `?log` for scheduled hits, and `?diagnostics` for signal levels along the drum path.

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
- `pattern.frag`: the pattern as one short Shadertoy program; what the build animation writes out.
- `shader.frag`: the original step-by-step version, used by the display and editing views.
- `renderer.js`: a minimal WebGL2 full-screen shader renderer (uniforms set by name), plus the `// Step` parser.
- `main.js` and `tile.html`: the display and editing views.
- `compare.html` and `compare.js`: `shader.frag` and `pattern.frag` side by side.
- `animate.js` and `index.html`: the build animation. Its timeline and code panel are read live from `pattern.frag`.
- `serve.js`: a static server with no dependencies, plus file-change events for live reload.
