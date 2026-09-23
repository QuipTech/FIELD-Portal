interface SwitchProps {
  on: boolean;
  onToggle?: () => void;
}

export const Switch = ({ on, onToggle }: SwitchProps) => {
  return (
    <button
      onClick={onToggle}
      className={`relative h-5 w-[34px] flex-none rounded-full transition-colors ${on ? "bg-primary" : "bg-borderGrayStrong"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[16px]" : "left-0.5"}`}
      />
    </button>
  );
};
