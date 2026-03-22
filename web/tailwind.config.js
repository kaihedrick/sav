/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bob: {
          pink: "#ff0088",
          mint: "#8df0cc",
          blue: "#0d63f8",
          blush: "#ffe4f3",
        },
      },
      fontFamily: {
        display: ["system-ui", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
