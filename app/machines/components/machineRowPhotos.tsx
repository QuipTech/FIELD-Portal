"use client";

import { useState, type MouseEvent } from "react";
import { Icon } from "@/components/icons/icon";
import type { FleetMachine } from "@/lib/types/machineFleet";

interface MachineRowPhotosProps {
  machine: Pick<FleetMachine, "label" | "photoUrl" | "photoUrls">;
}

const arrowClasses =
  "absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-inkStatic/60 text-white hover:bg-inkStatic/80";

// The thumbnail on a machine's list row: its photo, arrows through them when
// there are several, or a placeholder when there's none. The row is a link, so
// the arrows mustn't also open the machine.
export const MachineRowPhotos = ({ machine }: MachineRowPhotosProps) => {
  const photos = machine.photoUrls?.length ? machine.photoUrls : machine.photoUrl ? [machine.photoUrl] : [];
  const [position, setPosition] = useState(0);
  // A photo the browser can't show (expired link, HEIC) falls back to the icon.
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const index = position % Math.max(photos.length, 1);
  const url = photos[index];
  const canShow = url !== undefined && !failedUrls.includes(url);

  const step = (event: MouseEvent, delta: number) => {
    event.preventDefault();
    event.stopPropagation();
    setPosition((index + delta + photos.length) % photos.length);
  };

  return (
    <span className="relative flex h-14 w-20 flex-none items-center justify-center overflow-hidden rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray">
      {canShow ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL, not a static asset
        <img
          src={url}
          alt={`${machine.label}, photo ${index + 1} of ${photos.length}`}
          loading="lazy"
          onError={() => setFailedUrls((current) => [...current, url])}
          className="h-full w-full object-cover"
        />
      ) : (
        <Icon name="image" className="h-4 w-4" />
      )}
      {photos.length > 1 && (
        <>
          <button type="button" aria-label={`Previous photo of ${machine.label}`} onClick={(event) => step(event, -1)} className={`${arrowClasses} left-0.5`}>
            <Icon name="chevl" className="h-3 w-3" />
          </button>
          <button type="button" aria-label={`Next photo of ${machine.label}`} onClick={(event) => step(event, 1)} className={`${arrowClasses} right-0.5`}>
            <Icon name="chevr" className="h-3 w-3" />
          </button>
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-inkStatic/60 px-1 text-[10px] leading-4 text-white">
            {index + 1}/{photos.length}
          </span>
        </>
      )}
    </span>
  );
};
