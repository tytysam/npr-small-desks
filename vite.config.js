import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = (names) => new RegExp(`node_modules[\\\\/](${names.join('|')})[\\\\/]`);

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: {
    outDir: 'build',
    // The big chunks are all lazy: three.js (~740 KB, with the 3D set) and
    // react-player's DASH, HLS and Mux players (up to ~820 KB), which a
    // YouTube-only set never loads. What loads up front is ~300 KB.
    chunkSizeWarningLimit: 850,
    rolldownOptions: {
      output: {
        // Libraries change far less often than the app, so they get chunks of
        // their own and a deploy only invalidates the app's. The 3D ones are
        // only imported by the lazy 3D set, so they still load with it.
        codeSplitting: {
          groups: [
            { name: 'react', test: pkg(['react', 'react-dom', 'scheduler']), priority: 30 },
            { name: 'three', test: pkg(['three']), priority: 20 },
            { name: 'r3f', test: pkg(['@react-three', 'three-stdlib', '@monogrid', 'fflate', 'its-fine', 'zustand', 'suspend-react', 'react-use-measure']), priority: 10 },
          ],
        },
      },
    },
  },
  test: { globals: true, environment: 'node', setupFiles: ['src/test/setup.js'] },
});
