/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://<user>.github.io/dunku-lira/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/dunku-lira/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
