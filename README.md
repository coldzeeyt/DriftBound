# Driftbound

A browser-based, Geometry-Dash-style sideways scroller. The world scrolls
forward at a constant pace, you tap/hold/click to survive, and you can build
your own levels in an in-browser editor. No build step, no dependencies.

## Run it

```
node server.js
```

Then open http://localhost:8080 in a browser. (Or use any other static file
server — `python3 -m http.server`, `npx serve`, etc.)

## Controls

Space / Up Arrow / Click / Tap = the one action button. What it does depends
on your current game mode.

## Game modes

Five original modes, each with a genuinely different control scheme (not
reskins of any other game's modes):

- **Bolt** — press to jump when grounded; hold while ascending to jump
  higher (variable height, not a fixed-height tap-jump).
- **Pulsar** — hold to charge a launch, release to fire; a quick tap still
  gives a minimal hop, but holding longer launches you much further.
- **Comet** — never lands. Each tap snaps in a boost impulse; between taps
  you glide down at a slow, floaty capped speed instead of accelerating
  under full gravity.
- **Anchor** — press while grounded to leap the gap in a ~half-second eased
  arc to the opposite surface (floor/ceiling), instead of flipping there
  instantly — hazard timing during the arc matters.
- **Phase** — never lands; touching anything is deadly. Holding/releasing
  changes which way you're *accelerating*, not your velocity directly, so
  momentum carries through turns instead of snapping to a fixed direction.

Levels can switch your mode mid-run with **mode portals**, and flip which
way is "down" with **gravity portals**. Yellow **orbs** give a mid-air boost
when you press near them; pink **pads** bounce you automatically.

## Modes to play

- **Play** — four hand-built levels (First Steps, Afterburn, Surface
  Tension, Momentum) that ramp up in difficulty and mode variety, ending at
  a finish flag.
- **Endless Mode** — the level never ends. Obstacles are generated
  procedurally forever, speed and difficulty creep up with distance, and
  your best distance is saved locally.
- **Level Editor** — build your own levels from scratch.

## Level editor

- Pick a tool from the palette (spike, block, orb, pad, mode portals,
  gravity portal, finish, pit, eraser, pan) and click in the play area to
  place it on the grid.
- Right-click (or the Eraser tool) removes the nearest object.
- Click a ground-row cell with the **Pit** tool to toggle a hole in the
  floor.
- Drag with the **Pan** tool, use the scroll wheel, or arrow keys/WASD to
  move the camera.
- `Ctrl+Z` undoes the last placement/removal.
- **▶ Test** plays your level immediately without saving.
- **Save** stores it in your browser (`localStorage`), where it shows up
  under "My Levels" style entries in the level list, editable and
  deletable.
- **Export** downloads the level as a `.json` file; **Import** loads one
  back in.

## Project layout

```
index.html        Markup for every screen (menu, level select, HUD, editor)
css/style.css      All styling
js/core.js          Constants, input handling, WebAudio SFX, canvas/DPR setup
js/entities.js       Unified player physics for all 5 modes + rendering
js/levels.js         Level data format, built-in levels, persistence helpers
js/game.js           Play controller: finite levels + endless procedural mode
js/editor.js         Level editor
js/main.js           Screen wiring + main loop
server.js            Zero-dependency static file server for local play
```

Levels are plain JSON (see `js/levels.js` for the format and helper
functions used to build the built-in ones).
