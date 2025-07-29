import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      'all',
      'localhost',
      '127.0.0.1',
      '.loca.lt',
      'orange-pots-think.loca.lt'
    ],
  },
});
