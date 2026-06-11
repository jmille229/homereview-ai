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
        brand: {
          bg: '#F5F0E8',
          surface: '#FFFFFF',
          navy: '#1C2B3A',
          // Fill/decoration amber — dots, progress bars, borders, large display text.
          amber: '#B8722E',
          // Text amber — ≥4.5:1 on both the cream bg and white cards (WCAG AA).
          // Use for any amber text below ~24px.
          'amber-deep': '#9A5B1F',
          // ≥4.5:1 on cream and white at all sizes (the original #64748B was 4.2:1 on cream).
          muted: '#5A6678',
          border: '#DDD8CF',
          'border-dark': '#B0A898',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
