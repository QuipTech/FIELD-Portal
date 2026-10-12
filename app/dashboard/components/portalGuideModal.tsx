"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";

const ONBOARDING_DONE_KEY = "qt_onboarding_done";
// Set by the single-screen guide before this one; those users have already
// seen the welcome and shouldn't get it again.
const LEGACY_TUTORIAL_SEEN_KEY = "hasSeenTutorial";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to QuipTech FIELD",
    description:
      "Machine history, manuals and AI-backed answers, all in one place. This quick guide shows what your account can do.",
    icon: "spark",
  },
  {
    id: "fleet",
    title: "Your fleet, one tap away",
    description:
      "Scan an asset tag or search by serial to see its full history: configuration changes, services, parts and open cases, all on one timeline.",
    icon: "scan",
  },
  {
    id: "ai",
    title: "Ask FIELD AI",
    description:
      "Ask a question in plain words and get an answer from your manuals, bulletins and service history, with the source page cited so you can check it.",
    icon: "msg",
  },
  {
    id: "offline",
    title: "Works where you work",
    description:
      "No signal in the pit? Cached machines and manuals still open offline, and your notes sync when you're back in range.",
    icon: "wifioff",
  },
];

const hasCompletedOnboarding = () => {
  try {
    return Boolean(localStorage.getItem(ONBOARDING_DONE_KEY) || localStorage.getItem(LEGACY_TUTORIAL_SEEN_KEY));
  } catch {
    return false;
  }
};

const markOnboardingDone = () => {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "true");
  } catch {
    // Storage blocked (e.g. private mode): the guide just shows again next time.
  }
};

export const PortalGuideModal = () => {
  const [showTutorial, setShowTutorial] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      setShowTutorial(true);
    }
  }, []);

  // Finishing, skipping and closing all count as done.
  const dismissTutorial = () => {
    markOnboardingDone();
    setShowTutorial(false);
  };

  if (!showTutorial) {
    return null;
  }

  const step = ONBOARDING_STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  const goToNextStep = () => {
    if (isLastStep) {
      dismissTutorial();
      return;
    }
    setStepIndex((index) => index + 1);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(20,18,40,0.55)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-[440px] overflow-visible rounded-[20px] bg-surface shadow-[0_30px_60px_-20px_rgba(20,18,40,0.5)]"
      >
        <div className="relative h-24 rounded-t-[20px] bg-gradient-to-br from-brand via-brandDeep to-[#1B1740]">
          <Icon name="spark" className="absolute left-4 top-3.5 h-5 w-5 stroke-white/55" />
          <button
            aria-label="Close guide"
            onClick={dismissTutorial}
            className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.14]"
          >
            <Icon name="x" className="h-3.5 w-3.5 stroke-white" />
          </button>
          <div className="absolute -bottom-[26px] left-6 flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-surface shadow-[0_1px_2px_rgba(35,33,30,0.05),0_1px_3px_rgba(35,33,30,0.04)]">
            <Icon name={step.icon} className="h-6 w-6 stroke-primary" />
          </div>
        </div>
        <div className="flex flex-col gap-4 px-7 pb-6 pt-10">
          <div className="flex flex-col gap-2">
            <h1 id="onboarding-title" className="text-[22px] font-medium text-ink">
              {step.title}
            </h1>
            <span className="text-[15px] text-bodyGray">{step.description}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5"
              role="img"
              aria-label={`Step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}
            >
              {ONBOARDING_STEPS.map((onboardingStep, index) => (
                <span
                  key={onboardingStep.id}
                  className={
                    index === stepIndex
                      ? "h-[7px] w-[18px] rounded-full bg-primary"
                      : "h-[7px] w-[7px] rounded-full bg-borderGrayStrong"
                  }
                />
              ))}
            </div>
            <Button variant="ghost" className="ml-auto" onClick={dismissTutorial}>
              Skip
            </Button>
            {!isFirstStep && (
              <Button variant="default" onClick={() => setStepIndex((index) => index - 1)}>
                Back
              </Button>
            )}
            <Button variant="primary" onClick={goToNextStep}>
              {isLastStep ? "Get started" : "Next"}
              {!isLastStep && <Icon name="chevr" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
