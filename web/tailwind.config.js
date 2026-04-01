/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,css}"],
  theme: {
    extend: {
      colors: {
        bob: {
          pink: "#ff0088",
          ink: "#0c0c0c",
          muted: "#525252",
          blush: "#ffe4f3",
          rose: "#881337",
        },
      },
      fontFamily: {
        /** UI + headings (secondary) */
        sans: ['"DM Sans"', "system-ui", "Segoe UI", "sans-serif"],
        /** Wordmark + display serif (primary) */
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
        brand: ['"Cormorant Garamond"', "Georgia", "serif"],
        heading: ['"DM Sans"', "system-ui", "Segoe UI", "sans-serif"],
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
