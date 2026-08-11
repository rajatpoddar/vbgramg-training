import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // ----- Indian Tricolor palette (Government portal theme) -----
        saffron: {
          DEFAULT: "#FF9933", // Kesari / Saffron (top band)
          light: "#FFF3E0",
          dark: "#E07B00",
        },
        indiaGreen: {
          DEFAULT: "#138808", // India Green (bottom band)
          light: "#EAF7E8",
          dark: "#0B5E05",
        },
        navy: {
          DEFAULT: "#1B3A6B", // Formal government blue
          dark: "#0F2750",
        },
        ashoka: {
          DEFAULT: "#003366", // Ashoka Chakra navy blue
        },
        parchment: "#F9FAFB", // Subtle off-white background
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
