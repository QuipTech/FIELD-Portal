type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  initials: string;
  imageSrc?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-[30px] w-[30px] text-xs",
  lg: "h-14 w-14 text-lg",
};

export const Avatar = ({ initials, imageSrc, size = "md", className = "" }: AvatarProps) => {
  if (imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={initials}
        className={`flex-none rounded-full object-cover ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full bg-primaryTint font-medium text-primaryTintText ${sizeClasses[size]} ${className}`}
    >
      {initials}
    </span>
  );
};
