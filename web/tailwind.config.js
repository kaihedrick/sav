/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,css}"],
  theme: {
    extend: {
      colors: {
        bob: {
          /** Flyer: pale warm page (off-white cream, not gray) */
          cream: "#F6F1EA",
          /** Muted beige brushstroke / secondary ground */
          mist: "#E5D9CF",
          /** Flyer card bands — warm sandy beige */
          card: "#E9E0D6",
          ink: "#222222",
          muted: "#6B5E5A",
          wood: "#5D4037",
          gold: "#C5A059",
          "gold-dark": "#A67C32",
          peach: "#EDDED4",
          rose: "#D88A8A",
          magenta: "#E91E63",
          coral: "#FF5722",
          leaf: "#4CAF50",
          sky: "#03A9F4",
        },
      },
      fontFamily: {
        sans: ['"Montserrat"', "system-ui", "Segoe UI", "sans-serif"],
        serif: ['"Playfair Display"', "Georgia", "serif"],
        script: ['"Dancing Script"', "cursive"],
        heading: ['"Montserrat"', "system-ui", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
