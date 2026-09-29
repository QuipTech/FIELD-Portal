export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "field.theme";
const DARK_CLASS = "dark";

export const getAppliedTheme = (): Theme =>
  document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light";

export const applyTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle(DARK_CLASS, theme === "dark");
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): the theme still applies for this page.
  }
};

// Inlined into <head> by app/layout.tsx so the saved theme — or the OS
// preference when nothing is saved — is applied before first paint, with
// no flash of the wrong theme. Must stay self-contained plain JS.
export const themeInitScript = `(function () {
  try {
    var saved = localStorage.getItem("${THEME_STORAGE_KEY}");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) {
      document.documentElement.classList.add("${DARK_CLASS}");
    }
  } catch (error) {}
})();`;
