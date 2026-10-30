/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0f0f10', soft: '#29292c' },
        paper: '#ffffff',
        fog: '#f5f5f4',
        line: '#dededd',
        brand: { DEFAULT: '#120a8f', dark: '#0c0666', pale: '#eeedff' },
        action: { DEFAULT: '#db1431', dark: '#ad0f26', pale: '#fff0f2' },
      },
      fontFamily: {
        sans: ['Lato', 'Arial', 'sans-serif'],
        display: ['Lato', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 50px -30px rgba(15, 15, 16, 0.42)',
        card: '0 8px 28px -22px rgba(15, 15, 16, 0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(110%)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.75' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in .35s ease-out both',
        shimmer: 'shimmer 1.7s infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
