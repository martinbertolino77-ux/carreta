/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        verde: {
          50:  '#E8F5E9',
          100: '#C8E6C9',
          500: '#4CAF50',
          600: '#43A047',
          700: '#2E7D32',
          800: '#1B5E20',
        },
        azul: {
          50:  '#E3F2FD',
          100: '#BBDEFB',
          500: '#1976D2',
          600: '#1565C0',
          800: '#0D47A1',
        },
      },
      fontFamily: {
        sans: ['Inter','system-ui','sans-serif'],
      },
    },
  },
  plugins: [],
}
