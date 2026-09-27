"use client";

import { useEffect, useState } from "react";
import { IconButton } from "../ui/iconButton";
import { applyTheme, getAppliedTheme, type Theme } from "@/lib/theme/themePreference";

export const ThemeToggleButton = () => {
  // The <head> script has already applied the theme; read it after mount
  // so server and client renders match.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => setTheme(getAppliedTheme()), []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  };

  const isDark = theme === "dark";
  return (
    <IconButton
      icon={isDark ? "sun" : "moon"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      onClick={toggleTheme}
    />
  );
};
