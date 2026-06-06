# Nitro Clicker — Architecture

Nitro Clicker is structured as a static browser game loaded from `index.html` through a single JavaScript entrypoint and a single local CSS entrypoint.

## Entrypoints

```txt
index.html
├─ /css/base.css              shared static hub styles
├─ /css/theme.css             shared static hub theme
├─ /css/components.css        shared static hub components
├─ ./css/nitro.css            local Nitro Clicker style bundle
└─ ./js/bootstrap.js          local Nitro Clicker module bootstrap
```

## JavaScript layers

```txt
js/bootstrap.js
├─ app.js                     main game shell and loop
├─ ui/                        UI extension layer
├─ engine/                    runtime and state facades
├─ fx/                        visual/audio feedback layers
├─ lore/                      narrative progression systems
└─ debug/                     debug and QA tools
```

Current folder structure is transitional. The new folders contain facades that preserve compatibility with the older root-level modules. This avoids breaking deploy/cache behavior while allowing progressive migration.

## Current module map

```txt
js/engine/state.js            → ../clicker-state.js
js/engine/save.js             → ../clicker-save.js
js/engine/core-controls.js    → ../core-controls.js

js/ui/panels.js               → ../ui-panels.js
js/ui/svg-replacer.js         → ../svg-replacer.js
js/ui/shared-assets.js        → ../shared-assets.js

js/fx/overdrive.js            → ../overdrive-fx.js
js/fx/plasma-feedback.js      → ../plasma-feedback.js

js/lore/lemegeton-progression.js → ../lemegeton-progression.js

js/debug/dev-tools.js         → ../dev-tools.js
```

## CSS layers

```txt
css/nitro.css
├─ clicker.css
├─ progression.css
├─ biopunk-fx.css
├─ panels.css
├─ responsive.css
├─ svg-icons.css
├─ overdrive-fx.css
├─ shared-assets.css
├─ core-3d.css
├─ plasma-feedback.css
└─ lemegeton-progression.css
```

## Gameplay layers

### Engine

The engine layer owns state, save, balance and runtime behavior.

Main concepts:

- Energy and total energy
- Fragments
- Click power
- Passive production
- Auto-clicker
- Surcharge / Overdrive
- Prestige
- Scaling layers

### FX

The FX layer is visual/audio feedback only. It should not own progression rules.

Examples:

- Overdrive nova and core explosion
- Plasma arcs on core click
- Dopamine pulses on milestones, bars and upgrade readiness

### Lore

The lore layer translates progression into narrative states.

Current arc:

```txt
Noyau Nitro
→ BPRD energy accumulation
→ LEMEGETON boot
→ automated activity detected
→ LEMEGETON controls auto-clicker
→ core/LEMEGETON fusion
→ core cell duplication
→ Gwen Ha Star full power grid
```

## Refactor rules

1. Keep `index.html` thin.
2. Keep `bootstrap.js` as the only JS entrypoint.
3. Keep `nitro.css` as the only local CSS entrypoint.
4. Do not let FX modules mutate core balance directly.
5. Do not let lore modules own save data.
6. Prefer moving root modules into their final folders one at a time.
7. Keep compatibility facades until all imports are updated.

## Next migration steps

```txt
1. Move clicker-state.js into js/engine/state.js for real.
2. Move clicker-save.js into js/engine/save.js for real.
3. Move overdrive-fx.js into js/fx/overdrive.js.
4. Move plasma-feedback.js into js/fx/plasma-feedback.js.
5. Move lemegeton-progression.js into js/lore/lemegeton-progression.js.
6. Update app.js imports to use engine facades.
7. Delete old root modules only after verification.
```
