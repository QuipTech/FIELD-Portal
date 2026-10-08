export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// "Amrit Kaur" → "A. Kaur", as support case lists and thread lines show people.
export const abbreviateName = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim();
  return `${parts[0][0].toUpperCase()}. ${parts.slice(1).join(" ")}`;
};
