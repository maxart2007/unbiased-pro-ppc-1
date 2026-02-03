import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/unbiased-pro-ppc-1/' : '/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Three.js into its own chunk (largest library ~600KB)
          'three': ['three'],
          // Separate GSAP into its own chunk (~100KB)
          'gsap': ['gsap', 'gsap/ScrollTrigger'],
          // Separate Lenis into its own chunk (~20KB)
          'lenis': ['@studio-freight/lenis'],
        }
      }
    },
    // Increase chunk size warning limit (Three.js is inherently large)
    chunkSizeWarningLimit: 1000,
    // Optimize chunk size
    target: 'es2015',
    cssCodeSplit: true,
  },
}));
