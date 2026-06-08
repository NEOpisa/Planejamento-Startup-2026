import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0d0d0d",
        surface: "#141414",
        "surface-raised": "#1c1c1c",
        text: {
          primary: "#f0f0f0",
          secondary: "#a0a0a0",
          muted: "#606060",
        },
        accent: {
          DEFAULT: "#7c3aed",
          hover: "#6d28d9",
          light: "#9f6ef9",
        },
      },
      fontFamily: {
        display: ["Syne", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        orbitron: ["Orbitron", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
