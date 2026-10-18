# Tangle (web)

Web port of the Windows Phone "Tangle" puzzle. Move crossings to minimize the corners in the wires.

```
npm install
npm run dev      # dev server
npm test         # engine tests
npm run build    # type-check + production build into dist/
npm run levels   # regenerate src/levels.json from scripts/topList
```

- `src/engine.ts` – port of `ManipulationsWithTangle` / `TangleSolver`
- `src/board.ts` – SVG board and input (port of `Painter`)
- `src/main.ts` – screens (start, levels, game, help); progress in `localStorage`
