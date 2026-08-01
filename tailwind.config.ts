import type { Config } from "tailwindcss";

// Note: This project uses Tailwind CSS v4 with CSS-first configuration
// via globals.css (@theme inline). This config file is kept for backward
// compatibility but the actual theme is defined in globals.css.
// The tailwindcss-animate plugin is replaced by tw-animate-css (imported in globals.css).

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
