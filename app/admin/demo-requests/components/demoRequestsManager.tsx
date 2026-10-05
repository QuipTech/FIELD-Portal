"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getDemoRequestRequest } from "@/lib/api/demoRequestsApi";
import type { DemoRequest } from "@/lib/types/demoRequest";
import { PAGE_SIZE, useDemoRequests } from "../useDemoRequests";
import { DemoRequestStatusFilter } from "./demoRequestStatusFilter";
import { DemoRequestsTable } from "./demoRequestsTable";
import { DemoRequestDrawer } from "./demoRequestDrawer";

const OPEN_FAILED_MESSAGE = "Couldn't open that demo request.";

export const DemoRequestsManager = () => {
  const demoRequests = useDemoRequests();
  const [open, setOpen] = useState<DemoRequest | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { list } = demoRequests;
  const pageCount = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;
  // ?id=… is the link in the team's notification email.
  const linkedId = searchParams.get("id");

  useEffect(() => {
    if (!linkedId) return;
    let isCurrent = true;
    getDemoRequestRequest(requireAccessToken(), linkedId)
      .then((request) => isCurrent && setOpen(request))
      .catch((error: unknown) => isCurrent && setOpenError(toApiErrorMessage(error, OPEN_FAILED_MESSAGE)));
    return () => {
      isCurrent = false;
    };
  }, [linkedId]);

  const closeDrawer = () => {
    setOpen(null);
    if (linkedId) router.replace(pathname);
  };

  return (
    <>
      <div className="flex items-baseline">
        <h1 className="text-[22px] font-medium text-ink">Demo requests</h1>
        {list && (
          <span className="ml-auto text-xs text-mutedGray">
            {list.total} {list.total === 1 ? "request" : "requests"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          icon="search"
          placeholder="Search name, email or company"
          className="w-72"
          value={demoRequests.searchText}
          onChange={(event) => demoRequests.setSearchText(event.target.value)}
        />
        <DemoRequestStatusFilter value={demoRequests.status} onChange={demoRequests.setStatus} />
      </div>
      {openError && <span className="text-sm text-danger">{openError}</span>}
      {demoRequests.isLoading && !list && (
        <span className="flex items-center gap-2 p-10 text-sm text-mutedGray">
          <LoadingSpinner /> Loading demo requests…
        </span>
      )}
      {demoRequests.loadError && <span className="text-sm text-danger">{demoRequests.loadError}</span>}
      {list && <DemoRequestsTable items={list.items} onOpen={setOpen} />}
      {list && pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-mutedGray">
          <Button size="sm" onClick={() => demoRequests.setPage(demoRequests.page - 1)} disabled={demoRequests.page <= 1}>
            Previous
          </Button>
          <span>
            Page {demoRequests.page} of {pageCount}
          </span>
          <Button
            size="sm"
            onClick={() => demoRequests.setPage(demoRequests.page + 1)}
            disabled={demoRequests.page >= pageCount}
          >
            Next
          </Button>
        </div>
      )}
      {open && (
        <DemoRequestDrawer
          key={open.id}
          request={open}
          onSave={demoRequests.saveRequest}
          onResendEmails={demoRequests.resendEmails}
          onClose={closeDrawer}
        />
      )}
    </>
  );
};
