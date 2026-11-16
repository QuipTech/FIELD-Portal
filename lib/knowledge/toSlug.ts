// "Machine maintenance" → "machine-maintenance"; matches the API's slug pattern.
// Words are joined by a single "-" or "_" ("hemisphere_vr_dozer" stays as typed).
export const toSlug = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/([-_])[-_]+/g, "$1")
    .replace(/^[-_]+|[-_]+$/g, "");

// Cleans a slug while it's being typed: "Hemisphere_VR Dozer" → "hemisphere_vr-dozer".
// Keeps one trailing separator so the next word can still be typed; toSlug() trims it on save.
export const toSlugWhileTyping = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/([-_])[-_]+/g, "$1")
    .replace(/^[-_]+/, "");

export const SLUG_PATTERN = "[a-z0-9]+([\\-_][a-z0-9]+)*";
export const SLUG_HINT =
  "Lowercase letters, numbers, dashes and underscores only (e.g. hemisphere-gnss or hemisphere_gnss).";
