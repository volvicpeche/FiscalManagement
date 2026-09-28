import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // The Supabase project is configured once, in server/.env: the dev server
  // reads SUPABASE_URL from there to relay /supabase like nginx does.
  const { SUPABASE_URL } = loadEnv(mode, path.resolve(__dirname, '../server'), 'SUPABASE_');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        // Same relay as nginx in production (see src/lib/supabase.ts): the
        // browser only ever talks to its own origin. Authentication only.
        ...(SUPABASE_URL && {
          '/supabase/auth/v1': {
            target: SUPABASE_URL,
            changeOrigin: true,
            rewrite: (p: string) => p.replace(/^\/supabase/, ''),
          },
        }),
      },
    },
  };
});
