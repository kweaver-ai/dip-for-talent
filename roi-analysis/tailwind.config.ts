import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2937",
        mist: "#f7f4ef",
        accent: "#b45309",
        accentSoft: "#fef3c7",
        good: "#16a34a",
        warn: "#f59e0b",
        risk: "#dc2626"
      }
    }
  },
  plugins: []
} satisfies Config;
