import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1E2024",
        primary: "#4A34C7",
        primaryHover: "#372697",
        primaryTint: "#EDEBFA",
        primaryTintText: "#372697",
        primaryBorder: "#DAD5F6",
        primarySoft: "#F7F6FE",
        bodyGray: "#585C64",
        mutedGray: "#868B94",
        borderGray: "#E1E3E7",
        borderGrayStrong: "#CDD1D6",
        surfaceGray: "#F4F5F6",
        surfaceGrayAlt: "#FBFBFC",
        fillGray: "#EEEFF2",
        amber: "#A96A06",
        amberTint: "#FBF1DF",
        amberBorder: "#EFDCB6",
        danger: "#B4231A",
        dangerTint: "#FAEBE9",
        dangerBorder: "#EFC8C4",
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
