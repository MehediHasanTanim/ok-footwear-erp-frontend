import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// NOT using @vitejs/plugin-react-swc — swc conflicts with some jest transforms (see CONSTRAINTS)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Must match tsconfig.json paths EXACTLY — mismatched aliases cause
      // TS to pass typecheck but Vite/runtime to fail silently on import.
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/lib': resolve(__dirname, 'src/lib'),
      '@/stores': resolve(__dirname, 'src/stores'),
      '@/pages': resolve(__dirname, 'src/pages'),
      '@/types': resolve(__dirname, 'src/types'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
