"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";

const photoCount = 5;

export const MachinePhotoGallery = () => {
  const [activeIndex, setActiveIndex] = useState(1);

  return (
    <div className="flex w-[300px] flex-none flex-col gap-2">
      <div className="relative flex h-[168px] flex-col items-center justify-center gap-1.5 rounded-lg border border-borderGrayStrong bg-fillGray text-xs text-mutedGray">
        <Icon name="image" className="h-6 w-6" />
        Photo {activeIndex + 1} of {photoCount} · left side, pump bay
        <button
          onClick={() => setActiveIndex((index) => (index - 1 + photoCount) % photoCount)}
          className="absolute left-2 top-1/2 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-full border border-borderGrayStrong bg-white/90 shadow-sm"
        >
          <Icon name="chevl" />
        </button>
        <button
          onClick={() => setActiveIndex((index) => (index + 1) % photoCount)}
          className="absolute right-2 top-1/2 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-full border border-borderGrayStrong bg-white/90 shadow-sm"
        >
          <Icon name="chevr" />
        </button>
        <span className="absolute bottom-2.5 flex items-center gap-1.5">
          {Array.from({ length: photoCount }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-1.5 rounded-full ${index === activeIndex ? "bg-primary" : "bg-ink/20"}`}
            />
          ))}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: photoCount }).map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`flex h-10 w-[52px] flex-none items-center justify-center rounded-md border bg-fillGray text-mutedGray ${
              index === activeIndex ? "border-primary ring-2 ring-primaryTint" : "border-borderGrayStrong"
            }`}
          >
            <Icon name="image" className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="ml-auto text-xs text-primary">Add photo</span>
      </div>
    </div>
  );
};
