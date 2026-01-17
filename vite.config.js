import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/live-card-game/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
}))
