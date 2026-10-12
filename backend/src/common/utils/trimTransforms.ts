// class-transformer @Transform callbacks for DTO string fields.

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Blank strings count as "no value", so `?search=` behaves like no param.
export const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};
