import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0d3528' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0d3528' } },
  },
  images: ['public/icon.svg'],
});
