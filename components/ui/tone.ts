export type Tone = "default" | "primary" | "amber" | "danger" | "ok";

export const toneChipClasses: Record<Tone, string> = {
  default: "bg-fillGray text-bodyGray",
  primary: "bg-primaryTint text-primaryTintText",
  amber: "bg-amberTint text-amber",
  danger: "bg-dangerTint text-danger",
  ok: "border border-borderGrayStrong bg-surface text-bodyGray",
};

export const toneTagClasses: Record<Tone, string> = {
  default: "border-borderGrayStrong bg-fillGray text-bodyGray",
  primary: "border-primaryBorder bg-primaryTint text-primaryTintText",
  amber: "border-amberBorder bg-amberTint text-amber",
  danger: "border-dangerBorder bg-dangerTint text-danger",
  ok: "border-borderGrayStrong bg-surface text-bodyGray",
};

export const toneCardClasses: Record<Tone, string> = {
  default: "border-borderGray bg-surface",
  primary: "border-primaryBorder bg-primaryTint",
  amber: "border-amberBorder bg-amberTint",
  danger: "border-dangerBorder bg-dangerTint",
  ok: "border-borderGray bg-surface",
};
