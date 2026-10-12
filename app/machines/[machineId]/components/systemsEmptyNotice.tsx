"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";

// The Systems side nav when the machine has none: why, and what to do.
// Only platform admins can edit the Machine library.
export const SystemsEmptyNotice = ({ onCheckAgain }: { onCheckAgain: () => void }) => {
  const { isLoaded, can } = usePermissions();

  return (
    <div className="flex flex-col gap-2 px-2.5 text-sm text-white/70">
      <span className="font-medium text-white">No systems yet</span>
      <span className="text-xs leading-relaxed">
        They come from this machine&apos;s model in the Machine library.
      </span>
      {isLoaded && can(PERMISSIONS.managePlatform) && (
        <Link
          href="/admin/machines"
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.16] px-2.5 py-2 text-[13px] font-medium text-white hover:bg-white/25"
        >
          <Icon name="layers" className="h-3.5 w-3.5 stroke-white" />
          Open Machine library
        </Link>
      )}
      <button
        type="button"
        onClick={onCheckAgain}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-white/80 hover:bg-white/10"
      >
        <Icon name="history" className="h-3.5 w-3.5 stroke-white/70" />
        Check again
      </button>
    </div>
  );
};
