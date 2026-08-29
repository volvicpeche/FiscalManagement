import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      // The client has no test runner of its own, so its pure logic — the
      // projection column model, the CSV builder — is exercised here. That
      // needs the client's own alias to resolve.
      '@': path.resolve(__dirname, '../client/src'),
    },
  },
});
