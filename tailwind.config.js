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
  },
  plugins: [],
}
