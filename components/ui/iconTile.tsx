import { Icon, type IconName } from "../icons/icon";
import { toneChipClasses, type Tone } from "./tone";

type TileSize = "sm" | "md";

interface IconTileProps {
  icon: IconName;
  tone?: Tone;
  size?: TileSize;
  className?: string;
}

const sizeClasses: Record<TileSize, string> = {
  sm: "h-[28px] w-[28px]",
  md: "h-[34px] w-[34px]",
};

export const IconTile = ({ icon, tone = "default", size = "md", className = "" }: IconTileProps) => {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-lg ${sizeClasses[size]} ${toneChipClasses[tone]} ${className}`}
    >
      <Icon name={icon} />
    </span>
  );
};
