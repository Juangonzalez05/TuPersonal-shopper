import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Genera los íconos de la PWA desde public/icon.svg: npm run pwa:assets
// El maskable y el de Apple llevan el fondo oscuro del ícono para que no salga un borde blanco,
// y poco relleno porque el SVG ya trae su margen (la bolsa queda dentro de la zona segura).
export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.1, resizeOptions: { background: '#171717' } },
    apple: { ...preset.apple, padding: 0.1, resizeOptions: { background: '#171717' } },
  },
  images: ['public/icon.svg'],
})
