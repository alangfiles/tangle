import { defineConfig } from 'vite';

// relative base so the build works from any subpath (e.g. GitHub Pages project sites);
// output goes to docs/ so GitHub Pages can serve it directly
export default defineConfig({ base: './', build: { outDir: 'docs', emptyOutDir: true } });
