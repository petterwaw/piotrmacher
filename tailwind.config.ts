import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#4CAF50',
        'brand-hover': '#81C784',
        'brand-soft': '#66BB6A',
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
