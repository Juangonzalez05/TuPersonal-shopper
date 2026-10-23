import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Genera los íconos de la PWA desde el logo: npm run pwa:assets
// El logo ya es un cuadrado azul marino a sangre, así que los íconos normales van sin margen.
// El maskable lleva margen para que el aro dorado quede dentro de la zona segura (círculo
// central del 80 %), y el de Apple un poco de aire; ambos con el azul del logo de fondo.
const navy = '#010e2e'

export default defineConfig({
  preset: {
    ...preset,
    transparent: { ...preset.transparent, padding: 0 },
    maskable: { ...preset.maskable, padding: 0.12, resizeOptions: { background: navy } },
    apple: { ...preset.apple, padding: 0.04, resizeOptions: { background: navy } },
  },
  images: ['public/logo.jpg'],
})
