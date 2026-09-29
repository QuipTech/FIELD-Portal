import type { ImportModelTreePayload } from "@/lib/types/machineLibrary";

type ImportedSystems = ImportModelTreePayload["systems"];

const INVALID_JSON_MESSAGE = 'JSON must be a list of { "name", "components" } systems.';

const isImportedSystem = (value: unknown): value is ImportedSystems[number] => {
  const system = value as { name?: unknown; components?: unknown } | null;
  return (
    typeof system?.name === "string" &&
    (system.components === undefined ||
      (Array.isArray(system.components) && system.components.every((c) => typeof c === "string")))
  );
};

const parseJsonTree = (text: string): ImportedSystems => {
  const parsed: unknown = JSON.parse(text);
  const systems = Array.isArray(parsed) ? parsed : (parsed as { systems?: unknown } | null)?.systems;
  if (!Array.isArray(systems) || !systems.every(isImportedSystem)) throw new Error(INVALID_JSON_MESSAGE);
  return systems;
};

// One "System, Component" pair per line (a spreadsheet saved as CSV); a
// line with only a system name adds the system on its own.
const parseLineTree = (text: string): ImportedSystems => {
  const systems = new Map<string, string[]>();
  for (const line of text.split(/\r?\n/)) {
    const [systemName, ...rest] = line.split(",").map((cell) => cell.trim());
    if (!systemName) continue;
    const components = systems.get(systemName) ?? [];
    const componentName = rest.join(",").trim();
    if (componentName) components.push(componentName);
    systems.set(systemName, components);
  }
  return Array.from(systems, ([name, components]) => ({ name, components }));
};

// Throws with a message fit to show under the import box.
export const parseImportedTree = (text: string): ImportedSystems => {
  const trimmed = text.trim();
  const systems = /^[[{]/.test(trimmed) ? parseJsonTree(trimmed) : parseLineTree(trimmed);
  if (systems.length === 0) throw new Error("Add at least one system to import.");
  return systems;
};
