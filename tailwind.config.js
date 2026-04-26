/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        tg: {
          bg: '#0a0a0f',
          card: 'rgba(28, 28, 36, 0.72)',
          border: 'rgba(255, 255, 255, 0.08)',
          accent: '#3390ec',
          accentSoft: 'rgba(51, 144, 236, 0.2)',
          muted: 'rgba(255, 255, 255, 0.55)',
          surface: 'rgba(255, 255, 255, 0.06)',
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.35)',
        lifted: '0 12px 40px rgba(0, 0, 0, 0.45)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
