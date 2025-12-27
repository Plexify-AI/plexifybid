import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['plexify-shared-ui'] },
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'zustand',
      '@tiptap/react',
      '@tiptap/starter-kit',
    ],
    alias: {
      // During local dev, resolve plexify-shared-ui directly from source so consumers
      // don't depend on a prebuilt dist/ folder.
      'plexify-shared-ui': resolve(__dirname, 'plexify-shared-ui/src/index.ts'),

      // Force single instances across linked/shared packages.
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolve(
        __dirname,
        'node_modules/react/jsx-dev-runtime.js'
      ),
      '@dnd-kit/core': resolve(__dirname, 'node_modules/@dnd-kit/core'),
      '@dnd-kit/sortable': resolve(__dirname, 'node_modules/@dnd-kit/sortable'),
      '@dnd-kit/utilities': resolve(__dirname, 'node_modules/@dnd-kit/utilities'),
      zustand: resolve(__dirname, 'node_modules/zustand'),
      '@tiptap/react': resolve(__dirname, 'node_modules/@tiptap/react'),
      '@tiptap/starter-kit': resolve(
        __dirname,
        'node_modules/@tiptap/starter-kit'
      ),
      '@tiptap/extension-placeholder': resolve(
        __dirname,
        'node_modules/@tiptap/extension-placeholder'
      ),
      '@tiptap/extension-underline': resolve(
        __dirname,
        'node_modules/@tiptap/extension-underline'
      ),
      '@tiptap/extension-text-align': resolve(
        __dirname,
        'node_modules/@tiptap/extension-text-align'
      ),
      '@tiptap/extension-highlight': resolve(
        __dirname,
        'node_modules/@tiptap/extension-highlight'
      ),
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@features': resolve(__dirname, 'src/features'),
      '@services': resolve(__dirname, 'src/services'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
