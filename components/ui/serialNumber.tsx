// A list row's position ("1.", "2.", …), right-aligned so the dots line up.
export const SerialNumber = ({ value }: { value: number }) => (
  <span className="w-6 flex-none text-right text-sm tabular-nums text-mutedGray">{value}.</span>
);
