interface SwitchProps {
  on: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}

export const Switch = ({ on, onToggle, disabled = false }: SwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
      className={`relative h-5 w-[34px] flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-primary" : "bg-borderGrayStrong"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[16px]" : "left-0.5"}`}
      />
    </button>
  );
};
