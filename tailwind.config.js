/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'galano': ['Galano', 'sans-serif'],
        'lato': ['Lato', 'sans-serif'],
        'sans': ['Lato', 'sans-serif'], // Set Lato as default sans-serif
      },
    },
    screens: {
      'sm': '576px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1344px',
      '2xl': '1536px',
    },
  },
  plugins: [],
}
