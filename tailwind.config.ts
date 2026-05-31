import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-red':   '#E53E3E',
        'brand-blue':  '#0052CC',
        'brand-light': '#F4F5F7',
        'brand-dark':  '#1E293B',
      },
    },
  },
  plugins: [],
}

export default config