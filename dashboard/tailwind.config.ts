import type { Config } from "tailwindcss";
import { nextui } from "@nextui-org/react";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
        "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                background: "var(--bg-base)",
                foreground: "var(--text-primary)",
                primary: {
                    DEFAULT: "var(--color-primary)",
                    foreground: "#FFFFFF",
                },
                success: "var(--color-success)",
                warning: "var(--color-warning)",
                danger: "var(--color-destructive)",
                secondary: {
                    DEFAULT: "#9333ea", // Purple for secondary actions
                    foreground: "#FFFFFF",
                },
                surface: {
                    DEFAULT: "var(--surface-card)",
                    hover: "var(--surface-hover)",
                },
                divider: "var(--border-divider)",
                content1: "var(--surface-card)", // NextUI card background
                content2: "var(--surface-hover)",
            },
            fontFamily: {
                sans: [
                    "var(--font-futura)",
                    "\"Segoe UI Variable Text\"",
                    "\"Segoe UI\"",
                    "system-ui",
                    "sans-serif",
                ],
            },
            borderRadius: {
                lg: "24px",
                md: "16px",
                sm: "12px",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
            animation: {
                "fade-in": "fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            },
        },
    },
    plugins: [nextui()],
};
export default config;

