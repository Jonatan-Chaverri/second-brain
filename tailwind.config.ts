import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#fbf8f1",
          100: "#f3ede1",
          200: "#eadfc8",
          300: "#dbc9a0",
          400: "#c9ab6f",
          500: "#bc9153",
          600: "#a67846",
          700: "#875d3c",
          800: "#6f4d35",
          900: "#5b412f"
        }
      }
    }
  },
  plugins: []
};

export default config;
