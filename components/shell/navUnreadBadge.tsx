interface NavUnreadBadgeProps {
  count: number;
  // "light" on the customer nav; "amber" on the admin nav (A13).
  tone?: "light" | "amber";
}

const toneClasses = {
  light: "bg-white text-brandDeep",
  amber: "border border-amberBorder bg-amberTint text-amber",
};

// The count beside a nav item, e.g. unread support cases.
export const NavUnreadBadge = ({ count, tone = "light" }: NavUnreadBadgeProps) =>
  count > 0 ? (
    <span
      className={`ml-auto flex h-6 min-w-6 flex-none items-center justify-center rounded-md px-1.5 text-xs font-semibold ${toneClasses[tone]}`}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;
