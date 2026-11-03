// Adds the id to the list, or takes it out if it's already there.
export const toggleId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
