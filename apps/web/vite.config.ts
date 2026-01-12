import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    // https: {},
    port: 443,
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
    // mkcert({
    //   hosts: ['dev.s.kwaixiaodian.com'],
    // }),
  ],
})
