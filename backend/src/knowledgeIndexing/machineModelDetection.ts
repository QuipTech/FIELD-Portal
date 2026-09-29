export interface MachineModelRef {
  id: string;
  manufacturer: string;
  name: string;
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "CAT 793F", "Caterpillar 793F", or the bare model "793F". A bare name
// only counts when it contains a digit and is 3+ characters, so plain
// words that happen to be model names ("Titan") don't match everywhere.
const patternsFor = (model: MachineModelRef): RegExp[] => {
  const name = escapeRegExp(model.name).replace(/\\?\s+/g, '\\s*');
  const patterns = [
    new RegExp(`\\b${escapeRegExp(model.manufacturer)}\\s*${name}\\b`, 'gi'),
  ];
  if (/\d/.test(model.name) && model.name.length >= 3)
    patterns.push(new RegExp(`\\b${name}\\b`, 'gi'));
  return patterns;
};

// Machine-library models the text mentions, with how often (the most
// frequent pattern's count, so "CAT 793F" isn't counted twice).
export const detectMachineModels = (
  text: string,
  models: MachineModelRef[],
): { modelId: string; mentions: number }[] =>
  models
    .map((model) => ({
      modelId: model.id,
      mentions: Math.max(
        ...patternsFor(model).map(
          (pattern) => text.match(pattern)?.length ?? 0,
        ),
      ),
    }))
    .filter((match) => match.mentions > 0);
