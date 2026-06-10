import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the build works both locally and on GitHub Pages
  // (which serves project sites from /<repo-name>/).
  base: './',
});
