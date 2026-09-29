import type { ReactNode } from "react";
import { DecorativeBackdrop } from "./decorativeBackdrop";

interface AuthPanelBackgroundProps {
  children: ReactNode;
}

/**
 * Wraps the plain-white side of a split-screen auth page (opposite AuthVisual)
 * with the shared decorative backdrop so it doesn't read as flat/empty.
 */
export const AuthPanelBackground = ({ children }: AuthPanelBackgroundProps) => {
  return (
    <div className="relative flex-1 overflow-hidden bg-surface">
      <DecorativeBackdrop />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};
