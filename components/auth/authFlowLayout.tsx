import type { ReactNode } from "react";
import type { IconName } from "../icons/icon";
import { IconTile } from "../ui/iconTile";
import { AuthVisual } from "./authVisual";
import { AuthPanelBackground } from "./authPanelBackground";
import { StepDots } from "./stepDots";

interface AuthFlowLayoutProps {
  icon: IconName;
  title: string;
  subtitle: string;
  step: number;
  stepCount: number;
  children: ReactNode;
}

/**
 * Split-screen shell for the multi-step password-reset flow (request code ->
 * verify code -> set new password), so it reads as one continuous flow inside
 * the same branded frame as login/register instead of a bare centered card.
 */
export const AuthFlowLayout = ({ icon, title, subtitle, step, stepCount, children }: AuthFlowLayoutProps) => {
  return (
    <div className="flex min-h-screen">
      <AuthVisual
        heading={
          <>
            Built for the field.
            <br />
            Trusted by the fleet.
          </>
        }
        subtext="Live machine health, service history and expert knowledge, in one login for every technician on site."
      />
      <AuthPanelBackground>
        <div className="flex h-full flex-col items-center justify-center gap-5 p-10">
          <div className="flex w-full max-w-[360px] flex-col items-center gap-4 text-center">
            <StepDots step={step} stepCount={stepCount} />
            <IconTile icon={icon} tone="primary" className="h-12 w-12" />
            <div className="flex flex-col gap-1">
              <h1 className="text-[22px] font-medium text-ink">{title}</h1>
              <span className="text-xs text-mutedGray">{subtitle}</span>
            </div>
            <div className="flex w-full flex-col items-center gap-3.5">{children}</div>
          </div>
        </div>
      </AuthPanelBackground>
    </div>
  );
};
