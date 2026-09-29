import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Mirrors the @theme tokens in app/globals.css (the source of truth in Tailwind v4).
        'brand-bright': '#4CAF50',
        brand: '#2E7D32',
        'brand-hover': '#1B5E20',
        'brand-tint': '#E8F5E9',
        danger: '#C2410C',
        'danger-hover': '#9A3412',
        'text-main': '#000000',
        'text-muted': '#252525',
        'text-light': '#F2D2DE',
        'border-soft': '#E5E7EB',
        'bg-page': '#F5F6F8',
        'bg-hover': '#F3F4F6',
        'bg-surface': '#FFFFFF',
      },
    },
  },
  plugins: [],
}
export default config
