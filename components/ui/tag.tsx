import type { ReactNode } from "react";
import { toneTagClasses, type Tone } from "./tone";

interface TagProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

export const Tag = ({ children, tone = "default", className = "" }: TagProps) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs ${toneTagClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
};
