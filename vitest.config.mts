import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Component and hook tests for the portal (npm test). The backend has its
// own Jest suite.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"],
  },
});
