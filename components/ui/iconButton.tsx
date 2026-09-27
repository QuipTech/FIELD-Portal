import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "../icons/icon";
import { toneChipClasses, type Tone } from "./tone";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  tone?: Tone;
}

export const IconButton = ({ icon, tone = "default", className = "", ...props }: IconButtonProps) => {
  return (
    <button
      className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg transition-colors ${toneChipClasses[tone]} ${className}`}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
};
