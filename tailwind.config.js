/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        campo: { 50: "#F4F1EA", 100: "#E6EDDF", 500: "#5B7F44", 700: "#3F5B2E", 900: "#24331A" },
      },
    },
  },
  plugins: [],
};
