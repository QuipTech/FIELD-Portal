import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

/**
 * Button-styled navigation link — use instead of wrapping <Button> in <Link>,
 * which nests two interactive elements and is invalid HTML.
 */
export const LinkButton = ({ variant = "default", size = "md", className = "", children, ...props }: LinkButtonProps) => {
  return (
    <Link className={`${buttonBaseClasses} ${buttonVariantClasses[variant]} ${buttonSizeClasses[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
};
