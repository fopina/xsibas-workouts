import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.js',
        '**/*.config.js',
        'dist/'
      ]
    },
    include: ['src/**/*.test.js', 'tests/**/*.test.js'],
    exclude: ['tests/integration/**/*.test.js', 'node_modules/']
  }
});
