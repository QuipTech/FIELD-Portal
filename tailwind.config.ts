import type { Config } from "tailwindcss";

// Every colour is a CSS variable holding "R G B" channels (light values on
// :root, dark values on .dark — see globals.css), so opacity modifiers like
// bg-primary/40 keep working and the theme flips without dark: variants.
const themeColor = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

// Tailwind's slate scale is used directly in older screens; remapping it to
// variables makes those screens follow the theme too.
const SLATE_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: themeColor("ink"),
        primary: themeColor("primary"),
        primaryHover: themeColor("primaryHover"),
        primaryTint: themeColor("primaryTint"),
        primaryTintText: themeColor("primaryTintText"),
        primaryBorder: themeColor("primaryBorder"),
        primarySoft: themeColor("primarySoft"),
        bodyGray: themeColor("bodyGray"),
        mutedGray: themeColor("mutedGray"),
        borderGray: themeColor("borderGray"),
        borderGrayStrong: themeColor("borderGrayStrong"),
        surface: themeColor("surface"),
        surfaceGray: themeColor("surfaceGray"),
        surfaceGrayAlt: themeColor("surfaceGrayAlt"),
        fillGray: themeColor("fillGray"),
        amber: themeColor("amber"),
        amberTint: themeColor("amberTint"),
        amberBorder: themeColor("amberBorder"),
        danger: themeColor("danger"),
        dangerTint: themeColor("dangerTint"),
        dangerBorder: themeColor("dangerBorder"),
        // Same as light-mode ink but never flips: modal backdrops and the few
        // always-dark chips (tooltips, app-store badges) that carry white text.
        inkStatic: "#1E2024",
        // Brand purples for the gradient panels (side navs, rails, auth
        // visual), which look the same in both themes.
        brand: "#4A34C7",
        brandDeep: "#372697",
        slate: Object.fromEntries(SLATE_SHADES.map((shade) => [shade, themeColor(`slate-${shade}`)])),
      },
      fontFamily: {
        sans: [
          "var(--font-ibm-plex-sans)",
          "ui-sans-serif",
          "system-ui",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
