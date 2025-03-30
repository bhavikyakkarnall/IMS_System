import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API calls to the backend server (adjust port if needed)
      '/api': 'http://localhost:8080'
    }
  }
})
