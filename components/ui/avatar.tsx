"use client";

import { useState } from "react";

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
  // The src that failed to load, if any. Signed avatar URLs expire after
  // 15 minutes, so a long-open page falls back to initials, not a broken
  // image; a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (imageSrc && imageSrc !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={initials}
        // Google profile photos (lh3.googleusercontent.com) are often
        // refused when a Referer header is sent.
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(imageSrc)}
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
