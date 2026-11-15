import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#050608", 900: "#0a0c10", 850: "#0f1217", 800: "#141820", 700: "#1c212b", 600: "#272d39", 500: "#3a4252" },
        mist: { 100: "#eef2f8", 300: "#b8c1d1", 400: "#8b95a8", 500: "#646e82" },
        volt: { 300: "#7fb4ff", 400: "#4d95ff", 500: "#1f75ff", 600: "#145fe0", 700: "#0f49b0" },
        good: "#2fd38a",
        warn: "#ffb547",
        bad: "#ff5c6c",
      },
      fontFamily: {
        // The device's own font (SF Pro on iPhone): familiar and easy to read.
        sans: ["-apple-system", "BlinkMacSystemFont", "system-ui", '"Segoe UI"', "Roboto", "Helvetica", "Arial", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "system-ui", '"Segoe UI"', "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        glow: "none",
        card: "none",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        sheet: { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        rise: "rise .35s cubic-bezier(.2,.8,.2,1) both",
        sheet: "sheet .3s cubic-bezier(.2,.8,.2,1) both",
        fade: "fade .2s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
