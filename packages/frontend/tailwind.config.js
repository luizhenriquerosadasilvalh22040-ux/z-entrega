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
        // Escala neutra sem subtom azulado. Mantém legibilidade no modo claro
        // e produz superfícies true black consistentes no modo escuro.
        slate: {
          50: '#fafafa',
          100: '#f5f5f5',
          105: '#f3f3f3',
          150: '#ededed',
          200: '#e5e5e5',
          250: '#dcdcdc',
          300: '#d4d4d4',
          350: '#bdbdbd',
          400: '#a3a3a3',
          450: '#8f8f8f',
          500: '#737373',
          550: '#666666',
          600: '#525252',
          650: '#484848',
          700: '#404040',
          750: '#333333',
          800: '#262626',
          850: '#1b1b1b',
          900: '#121212',
          950: '#000000',
        },
        energy: {
          light: '#ff8533',
          DEFAULT: '#FF6600',
          dark: '#cc5200',
        },
        night: {
          light: '#1b1b1b',
          DEFAULT: '#121212',
          dark: '#000000',
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
