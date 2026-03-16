import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
        segoe: ["Segoe UI", "Segoe UI Web (West European)", "system-ui", "sans-serif"],
      },
      colors: {
        navy: {
          DEFAULT: "#0f1f3d",
          mid: "#1a3260",
          light: "#243d73",
        },
        accent: {
          DEFAULT: "#3b82f6",
          bright: "#60a5fa",
        },
        gold: {
          DEFAULT: "#f59e0b",
          light: "#fcd34d",
        },
        teal: {
          DEFAULT: "#0d9488",
        },
        rose: {
          DEFAULT: "#e11d48",
        },
        violet: {
          DEFAULT: "#7c3aed",
        },
        surface: {
          DEFAULT: "#f8faff",
          2: "#eef2fb",
        },
        "design-border": "#dde5f5",
        "text-primary": "#0f1f3d",
        "text-secondary": "#4a5a82",
        "text-muted": "#8a97b8",
        // Legacy MS colors (keep for backwards compatibility)
        "ms-purple": "#742774",
        "ms-bg": "#f3f2f1",
        "ms-border": "#edebe9",
        "ms-text": "#323130",
        "ms-muted": "#605e5c",
        "ms-link": "#0078d4",
        "ms-green": "#107c10",
        "ms-avatar-blue": "#0078d4",
        "ms-avatar-green": "#107c10",
        "ms-avatar-red": "#a80000",
        "ms-avatar-purple": "#8764b8",
        "ms-avatar-orange": "#ca5010",
        "ms-avatar-teal": "#038387",
        "ms-avatar-gray": "#5a5a5a",
        "ms-hover": "#edebe9",
        // Shadcn compatible colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        card: "14px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "8px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(15,31,61,0.07), 0 0 1px rgba(15,31,61,0.1)",
        "card-hover": "0 8px 30px rgba(59,130,246,0.18), 0 2px 8px rgba(15,31,61,0.1)",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease both",
        "pulse-slow": "pulse 2s infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
