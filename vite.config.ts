// app.config.ts
import { defineConfig } from '@tanstack/start/config';

export default defineConfig({
  server: {
    preset: 'vercel' // Change this from 'cloudflare' or 'cloudflare-pages' to 'vercel'
  }
});
