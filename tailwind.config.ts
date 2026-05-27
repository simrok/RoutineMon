import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["var(--font-press-start)", "monospace"],
        galmuri: ["Galmuri11", "sans-serif"],
      },
      colors: {
        "bg-top": "#100B3F",
        "bg-mid": "#33256C",
        "bg-bottom": "#7C52B0",
        "cloud-pink": "#b896c9",
        mint: "#7FE7D8",
        cyan: "#00F0FF",
        green: "#00E090",
        yellow: "#FFF200",
        red: "#FF1A1A",
        pink: "#F5A6D6",
        lavender: "#CBB8F2",
        blue: "#A9CDF5",
        purple: "#6D40FF",
        "btn-mint": "#8EE8D8",
        "btn-blue": "#A9CDF5",
        "btn-pink": "#F5B5DF",
        "btn-lavender": "#CCB8F5",
        "text-cyan": "#00F0FF",
        "text-green": "#00E090",
        "text-yellow": "#FFF200",
        "text-red": "#FF1A1A",
        "text-purple": "#6D40FF",
        "exp-block": "#BE56D9",
        "star-collected": "#00F0D8",
        "star-special": "#D0FF20",
        "star-empty": "#D5D5D5",
        "dex-bg-dark": "#40365F",
        "dex-tab-pink": "#FFE0E2",
        "photo-time": "#5B35FF",
        "photo-star": "#1FF4E1",
      },
    },
  },
  plugins: [],
};

export default config;