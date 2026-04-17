import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { notebookBDAgentsMiddleware } from './src/server/agentsApi';
import { notebookBDTtsMiddleware } from './src/server/ttsApi';
import { notebookBDPodcastMiddleware } from './src/server/podcastApi';
import { notebookBDDocxMiddleware } from './src/server/docxApi';
import { healthMiddleware } from './src/server/healthApi';
import { agentManagementMiddleware } from './src/server/agentManagementApi';
import { askPlexiMiddleware } from './src/server/askPlexiApi';
import { usageEventsMiddleware } from './src/server/usageEventsApi';
import { dealRoomsMiddleware } from './src/server/dealRoomsApi';
import { powerflowMiddleware } from './src/server/powerflowApi';
import { pipelineSummaryMiddleware } from './src/server/pipelineSummaryApi';
import { authMiddleware } from './src/server/authApi';
import { sandboxAuthDevMiddleware } from './src/server/sandboxAuthMiddleware';
import { systemStatusMiddleware } from './src/server/systemStatusApi';
import { signalsMiddleware } from './src/server/signalsApi';
import { opportunitiesMiddleware } from './src/server/opportunitiesApi';
import { activityFeedMiddleware } from './src/server/activityFeedApi';
import { outreachSequenceMiddleware } from './src/server/outreachSequenceApi';
import { voiceDnaMiddleware } from './src/server/voiceDnaApi';
import { linkedinImportMiddleware } from './src/server/linkedinImportApi';
import { emailAuthMiddleware } from './src/server/emailAuthApi';
import { pptxExportMiddleware } from './src/server/pptxApi';
import { batchEmailMiddleware } from './src/server/batchEmailApi';
import { preferencesMiddleware } from './src/server/preferencesApi';
import { userPreferencesMiddleware } from './src/server/userPreferencesApi';
import { voiceCorrectionsMiddleware } from './src/server/voiceCorrectionsApi';
import { askplexiConversationsMiddleware } from './src/server/askplexiConversationsApi';
import { leadImportMiddleware } from './src/server/leadImportApi';
import { jobsMiddleware } from './src/server/jobsApi';
import { skillsMiddleware } from './src/server/skillsApi';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Ensure .env/.env.local are available to our dev-only server middleware.
  // (Vite exposes env to client via import.meta.env, but our Node middleware reads process.env.)
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    // Prefer values from env files over any pre-existing process env,
    // so local dev behaves predictably.
    process.env[k] = v;
  }

  return {
  plugins: [
    react(),
    {
      name: 'plexifysolo-api',
      configureServer(server) {
        // Auth validate (public — no auth needed)
        server.middlewares.use(authMiddleware());
        // Sandbox auth gate (must come before protected API routes)
        // Note: /api/auth/email/microsoft/callback is in PUBLIC_PATHS (skips auth)
        server.middlewares.use(sandboxAuthDevMiddleware());
        // Email OAuth routes (callback is public, connect/disconnect/status need auth)
        server.middlewares.use(emailAuthMiddleware());
        // Protected API routes
        server.middlewares.use(notebookBDAgentsMiddleware());
        server.middlewares.use(notebookBDTtsMiddleware());
        server.middlewares.use(notebookBDPodcastMiddleware());
        server.middlewares.use(notebookBDDocxMiddleware());
        server.middlewares.use(pptxExportMiddleware());
        server.middlewares.use(batchEmailMiddleware());
        server.middlewares.use(preferencesMiddleware());
        server.middlewares.use(userPreferencesMiddleware());
        server.middlewares.use(voiceCorrectionsMiddleware());
        server.middlewares.use(askplexiConversationsMiddleware());
        server.middlewares.use(healthMiddleware());
        server.middlewares.use(agentManagementMiddleware());
        server.middlewares.use(askPlexiMiddleware());
        server.middlewares.use(usageEventsMiddleware());
        server.middlewares.use(dealRoomsMiddleware());
        server.middlewares.use(powerflowMiddleware());
        server.middlewares.use(pipelineSummaryMiddleware());
        server.middlewares.use(systemStatusMiddleware());
        server.middlewares.use(signalsMiddleware());
        server.middlewares.use(opportunitiesMiddleware());
        server.middlewares.use(activityFeedMiddleware());
        server.middlewares.use(outreachSequenceMiddleware());
        server.middlewares.use(voiceDnaMiddleware());
        server.middlewares.use(linkedinImportMiddleware());
        server.middlewares.use(leadImportMiddleware());
        server.middlewares.use(jobsMiddleware());
        server.middlewares.use(skillsMiddleware());
      },
    },
  ],
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
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  };
});
