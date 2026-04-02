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
        /** App UI + headings; header wordmark uses `.wordmark-title` (system sans stack in CSS) */
        sans: ['"DM Sans"', "system-ui", "Segoe UI", "sans-serif"],
        heading: ['"DM Sans"', "system-ui", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
