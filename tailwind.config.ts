import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces — warm near-black (Whoop warmth + Aman earth)
        background: "#0F0E0D",
        surface: "#161412",
        "surface-elevated": "#1C1917",
        border: "#2A2724",
        // PURA signature accent
        magenta: "#E879F9",
        // Zone colors — softened (less stoplight, more earthy)
        "signal-green": "#4ADE80",
        amber: "#FBBF24",
        danger: "#F87171",
        // Typography — warm off-white hierarchy
        "text-primary": "#F5F1E8",
        "text-secondary": "#A8A29A",
        "text-muted": "#6B655F",
      },
      fontFamily: {
        // Serif: clinic name, patient names, signal numbers, briefing headline
        serif: ["Instrument Serif", "Georgia", "serif"],
        // Sans: everything else
        sans: ["Geist", "system-ui", "sans-serif"],
        // Mono: <code> blocks in admin pages only
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
