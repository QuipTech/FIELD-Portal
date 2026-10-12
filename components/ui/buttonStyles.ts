export type ButtonVariant = "default" | "primary" | "danger" | "ghost";
export type ButtonSize = "lg" | "md" | "sm";

export const buttonBaseClasses =
  "inline-flex flex-none items-center justify-center gap-2 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  default: "border-borderGrayStrong bg-surface text-ink hover:bg-surfaceGray",
  primary: "border-primary bg-primary text-white hover:bg-primaryHover",
  danger: "border-dangerBorder bg-surface text-danger hover:bg-dangerTint",
  ghost: "border-transparent bg-transparent text-bodyGray hover:bg-fillGray",
};

export const buttonSizeClasses: Record<ButtonSize, string> = {
  lg: "h-11 px-5 text-[16px]",
  md: "h-9 px-3.5 text-[15px]",
  sm: "h-[30px] px-2.5 text-[13px]",
};
