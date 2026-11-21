# kendalhead12.github.io

## Pixel Fighter Engine

A M.U.G.E.N-inspired 2D pixel-art fighting game **with a no-code character creator**.

- Play: [`/pixel-fighter/`](./pixel-fighter/) (static build, served by GitHub Pages)
- Source: [`/pixel-fighter-src/`](./pixel-fighter-src/) (TypeScript + React + Canvas, built with Vite)

Build: `cd pixel-fighter-src && npm install && npm run build` (outputs to `../pixel-fighter`).

## Aaron the Fighter!

A complete GBA-style 2D pixel-art platformer: 8 worlds, 24 acts, 8 minibosses and a 3-phase final boss.

- Play: [`/aaron-the-fighter/`](./aaron-the-fighter/) (plain HTML5 Canvas + JavaScript, no build step; also runs straight from the file system)
- Controls: Arrows/WASD move, Space jump, J attack (hold to charge), K special, Shift dash/roll, Enter pause. On-screen touch controls on phones/tablets.
- Dev tool: `node aaron-the-fighter/tools/check_levels.js` simulates jump physics over every level and reports any unreachable goal, medallion, ability capsule or artifact.

## Chaos Sandbox

A 3D first-person physics sandbox (Three.js + Rapier, plain JavaScript modules, no build step). Spawn humans, zombies, monsters, props, vehicles and weapons, then watch what happens.

- Play: [`/physics-sandbox/`](./physics-sandbox/) (served by GitHub Pages; needs a web server because it uses ES modules, so it won't run from `file://`)
- Maps: Superflat, Abandoned City, Forest, Testing Facility, Desert
- Creatures: humans with personalities (fear, panic, hiding, warning others, anger and retaliation), four zombie types, the Maneater, a juvenile Maneater, skeletons and training dummies, all with jointed ragdolls
- Weapons: fists, bat, crowbar, hammer, sword, pistol, revolver, shotgun, SMG, assault rifle, sniper rifle, physics gun, gravity gun, freeze ray, energy blaster, shockwave cannon, tool gun
- Tools: remover, weld, freeze, health editor, NPC possession, NPC spawner, free camera, time controller, faction editor, save/load, undo
- Controls: WASD move, mouse look, LMB attack, RMB aim/secondary, Space jump, Shift sprint, E pick up, G drop, Q spawn menu, R reload, F interact, V noclip, C free camera, Z undo, T slow motion, P pause simulation, ESC pause menu
- Blood is optional (Settings → Effects) and there's an effects-intensity slider.
- Code: `physics-sandbox/js/` (`main.js` loop, `player.js`, `weapons.js`, `interact.js` tools, `combat.js`, `physics.js`, `maps.js`, `spawn.js`, `ui.js`, `creatures/*` AI + rigs + ragdolls). Libraries are vendored in `physics-sandbox/lib/` (MIT / Apache-2.0 licenses included).
