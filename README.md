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
