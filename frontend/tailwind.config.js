/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        green: {
          50: '#e5f3ea',
          100: '#c3e6d1',
          500: '#18734a',
          600: '#156540',
          700: '#115234',
          800: '#103e2a',
          900: '#003d2d',
        }
      }
    },
  },
  plugins: [],
}
