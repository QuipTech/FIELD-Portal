"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";

const TUTORIAL_SEEN_KEY = "hasSeenTutorial";

export const PortalGuideModal = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_SEEN_KEY);
    if (!seen) {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
    setShowTutorial(false);
  };

  if (!showTutorial) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(20,18,40,0.55)]">
      <div className="w-[440px] overflow-visible rounded-[20px] bg-surface shadow-[0_30px_60px_-20px_rgba(20,18,40,0.5)]">
        <div className="relative h-24 overflow-hidden rounded-t-[20px] bg-gradient-to-br from-brand via-brandDeep to-[#1B1740]">
          <Icon name="spark" className="absolute left-4 top-3.5 h-5 w-5 stroke-white/55" />
          <button
            onClick={dismissTutorial}
            className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.14]"
          >
            <Icon name="x" className="h-3.5 w-3.5 stroke-white" />
          </button>
          <div className="absolute -bottom-[26px] left-6 flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-surface shadow-[0_1px_2px_rgba(35,33,30,0.05),0_1px_3px_rgba(35,33,30,0.04)]">
            <Icon name="spark" className="h-6 w-6 stroke-primary" />
          </div>
        </div>
        <div className="flex flex-col gap-4 px-7 pb-6 pt-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-medium text-ink">Welcome to QuipTech FIELD</h1>
            <span className="text-[15px] text-bodyGray">
              Machine history, manuals and AI-backed answers, all in one place. This quick guide shows what your
              account can do.
            </span>
          </div>
          <div className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span className="h-[7px] w-[18px] rounded-full bg-primary" />
              <span className="h-[7px] w-[7px] rounded-full bg-borderGrayStrong" />
              <span className="h-[7px] w-[7px] rounded-full bg-borderGrayStrong" />
            </div>
            <Button variant="primary" className="ml-auto" onClick={dismissTutorial}>
              Next
              <Icon name="chevr" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
