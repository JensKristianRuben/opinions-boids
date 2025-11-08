/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          400: 'rgb(156 163 175)',
          700: 'rgb(55 65 81)',
          800: 'rgb(31 41 55)',
          900: 'rgb(17 24 39)',
        },
        blue: {
          400: 'rgb(96 165 250)',
          600: 'rgb(37 99 235)',
          700: 'rgb(29 78 216)',
        },
        yellow: {
          400: 'rgb(250 204 21)',
        },
        green: {
          600: 'rgb(22 163 74)',
        },
        red: {
          600: 'rgb(220 38 38)',
        },
        pink: {
          500: 'rgb(236 72 153)',
        },
        cyan: {
          400: 'rgb(34 211 238)',
        },
      },
    },
  },
  plugins: [],
};
