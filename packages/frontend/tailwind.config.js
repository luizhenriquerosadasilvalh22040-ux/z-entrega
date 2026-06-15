/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        energy: {
          light: '#ff8533',
          DEFAULT: '#FF6600',
          dark: '#cc5200',
        },
        night: {
          light: '#1f1f1f',
          DEFAULT: '#121212',
          dark: '#0a0a0a',
        },
        soft: '#F2F2F2',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
