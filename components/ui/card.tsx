import type { ReactNode } from "react";
import { toneCardClasses, type Tone } from "./tone";

interface CardProps {
  children: ReactNode;
  tone?: Tone;
  direction?: "row" | "col";
  className?: string;
}

export const Card = ({ children, tone = "default", direction = "col", className = "" }: CardProps) => {
  return (
    <div
      className={`flex gap-2.5 rounded-xl border p-3.5 shadow-[0_1px_2px_rgba(35,33,30,0.05),0_1px_3px_rgba(35,33,30,0.04)] ${
        direction === "row" ? "flex-row" : "flex-col"
      } ${toneCardClasses[tone]} ${className}`}
    >
      {children}
    </div>
  );
};
