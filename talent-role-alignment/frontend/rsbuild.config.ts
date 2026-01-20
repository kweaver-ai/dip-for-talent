import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: 'DIP for Talent',
    meta: {
      viewport: 'width=device-width, initial-scale=1',
    },
    template: './src/index.html',
  },
  source: {
    entry: {
      index: './src/main.tsx',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
});
