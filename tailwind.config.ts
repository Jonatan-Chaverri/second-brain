import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      screens: {
        nav: "1000px"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        sand: {
          50: "#0a0a0d",
          100: "#131318",
          200: "#1f1f27",
          300: "#2b2b35",
          400: "#3d3d4a",
          500: "#8a8a99",
          600: "#aeaebb",
          700: "#cacad4",
          800: "#e2e2e8",
          900: "#f4f4f7"
        }
      }
    }
  },
  plugins: []
};

export default config;
