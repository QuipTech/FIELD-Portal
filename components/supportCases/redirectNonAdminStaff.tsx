"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupportStaffAccess } from "@/lib/hooks/useSupportStaffAccess";

// Assigned staff who aren't the admin work their cases in the client
// portal (Support cases); emails and notifications still link to
// /admin/cases, so send them across.
export const RedirectNonAdminStaff = ({ to }: { to: string }) => {
  const router = useRouter();
  const { isLoaded, isStaff, isAdmin } = useSupportStaffAccess();
  useEffect(() => {
    if (isLoaded && isStaff && !isAdmin) router.replace(to);
  }, [isLoaded, isStaff, isAdmin, router, to]);
  return null;
};
