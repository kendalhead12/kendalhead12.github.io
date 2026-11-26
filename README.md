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
- Gore: limbs and heads can be cut, shot or blown off, explosions and crushing impacts gib bodies, wounds and stumps bleed (NPCs can bleed out), and blood pools spread under corpses. Maneaters eat their prey part by part (sometimes everything, sometimes throwing half away) and scavenge corpses. Turn off Blood Effects or Dismemberment & Gibs in Settings → Effects to disable it; the Maneater then uses a non-graphic attack.
- Code: `physics-sandbox/js/` (`main.js` loop, `player.js`, `weapons.js`, `interact.js` tools, `combat.js`, `physics.js`, `maps.js`, `spawn.js`, `ui.js`, `creatures/*` AI + rigs + ragdolls). Libraries are vendored in `physics-sandbox/lib/` (MIT / Apache-2.0 licenses included).

## Pixel World: Civilization Sandbox

A 2D pixel-art god sandbox focused on civilization, geography, languages, diplomacy and long-form history (plain HTML5 Canvas + JavaScript, no build step; also runs straight from the file system).

- Play: [`/pixel-world/`](./pixel-world/)
- Worlds: random continents (seed, size, land coverage, island frequency, rivers, lakes, mountain ranges), blank ocean, or hand-drawn continents
- Terrain editing: layered materials (soil, grass, sand, shallow/deep water, stone, mountains, snow, forest), 8 biome brushes, pencil, eraser (peels the top layer), paint-bucket flood fill, line, picker, coastline smoothing, brush size, undo/redo
- Simulation: bands of named humans explore, camp, settle, farm and migrate; settlements grow from hamlets to metropolises through six eras (Primitive → Modern) with era-specific buildings, roads, walls, ports, factories, railways and highways
- Nations: procedural names, flags, colours, governments, cultures and languages; wars with occupation, peace treaties, alliances, trade, independence, collapse and unification, with ink-bleed territory animation
- History: per-country gallery (past borders, flags, names, population graphs, events), fallen-civilizations archive, world timelapse, statistics and comparisons
- Map modes: terrain, political, administrative, language, population, diplomacy, technology, infrastructure
- Saves: multiple IndexedDB slots, autosave, rename, JSON export/import
- Controls: drag/right-drag/Space to pan, wheel or pinch to zoom, `P` pause, `1`–`8` map modes, `I B E F L K M H G` tools, `[`/`]` brush size, `Ctrl+Z`/`Ctrl+Y` undo/redo

## UNMADE

An original story-driven RPG inspired by Undertale (plain HTML5 Canvas + JavaScript, no build step, runs straight from the file system). A small round creation with stick legs and no hands falls through the Creator's unfinished machine into the sealed monster dimension.

- Play: [`/unmade/`](./unmade/)
- Chapter 1 is complete and fully playable: the Creator's workshop prologue, the Dark Hallways (Sun's "tutorial", the Ex-Queen's rescue, puzzles, her home, her test at the great door) and Frostwood (FunnyGuyDev and Superkendal, the ice puzzle, Catty, the town of Snowbell, Princess Calia's "combat training", and Superkendal's final test on the bridge).
- Battles: FIGHT (timed kick), ACT (enemy-specific actions), ITEM, MERCY (spare / flee); bullet-hell dodging with your SOUL; black-and-white battle sprites, coloured overworld.
- Routes are tracked from the first step: Pacifist, Neutral, No Mercy and Genocide (area encounter populations, the HANDS weapon, empty areas, route-specific scenes). Sun and FunnyGuyDev remember resets; a second Genocide run makes monsters afraid.
- Saves use `localStorage` (only keys starting with `unmade.`). RESET restarts the story but keeps "meta" memories; Settings → Erase All Data wipes everything after two confirmations.
- Controls: Arrows/WASD move, Z/Enter confirm, X/Shift cancel (hold to run / move the SOUL slowly), C/Ctrl menu, Esc pause. On-screen D-pad and buttons appear on touch devices (or force them in Settings).
- Settings: music and sound volume, text speed, reduce flashing, reduce screen shake, touch controls, fullscreen.
- Code: `unmade/js/` — `core.js` (coroutines), `font.js`, `input.js`, `audio.js` + `music.js` (synth + original soundtrack), `gfx.js`, `art_*.js`, `tiles.js`, `state.js` (save/routes), `dialogue.js`, `world.js`, `battle.js` + `bullets.js`, `enemies_ch1.js`, `bosses_ch1.js`, `rooms_*.js` (maps + story), `menus.js`, `main.js`. New areas are added with `U.defRoom`, new enemies with `U.Enemy`, new songs with `U.Audio.define`.
- Debug: `?debug&room=frost_town` jumps into a room with a test file; `?battle=catty` starts a battle; `&noenc` disables random encounters.
