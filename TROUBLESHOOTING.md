# Troubleshooting

## `Invalid hook call` when consuming `plexify-shared-ui`

**Symptom**

- Workspace (or other shared-ui components) white-screens and the console shows:
  - `Invalid hook call. Hooks can only be called inside of the body of a function component...`
  - Often followed by `Cannot read properties of null (reading 'useMemo')` coming from `@dnd-kit/*` hooks.

**Cause**

This almost always means the app has **multiple copies of React** (and/or hook-based dependencies like `@dnd-kit/*`) loaded at runtime.

This is easy to trigger during local development when `plexify-shared-ui` is linked via `file:../plexify-shared-ui` and that linked folder contains its own `node_modules`.

**Fix (Vite)**

In the consuming app's `vite.config.ts`, ensure Vite dedupes these packages so a single instance is used:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
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

    // If you are using a linked `../plexify-shared-ui` that has its own node_modules,
    // aliases are the most reliable way to force a single instance.
    alias: {
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
    },
  },
});
```

**Also recommended**

- If you're linking locally, consider removing `../plexify-shared-ui/node_modules` (or avoid installing React there) so React is only resolved from the consuming app.
