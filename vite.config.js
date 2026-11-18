import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [react(), mkcert()],

  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },

  server: {
    https: {},
    open: true,
    port: 5173,
    strictPort: true,
  },
});