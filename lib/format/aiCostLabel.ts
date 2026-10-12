// AI costs are often fractions of a cent, so small amounts keep enough
// decimals to stay visible: $12.40, $0.002, $0.00003, "< $0.00001".
const SMALLEST_SHOWN = 0.00001;

export const formatAiCost = (value: number): string => {
  if (value === 0) return "$0";
  if (value < SMALLEST_SHOWN) return `< $${SMALLEST_SHOWN.toFixed(5)}`;
  const decimals = value >= 1 ? 2 : Math.min(5, 1 - Math.floor(Math.log10(value)));
  return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: decimals })}`;
};
