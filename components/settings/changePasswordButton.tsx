"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { VerificationCodeInput } from "@/components/auth/verificationCodeInput";
import {
  completePasswordReset,
  requestPasswordReset,
  toCognitoErrorMessage,
} from "@/lib/auth/cognitoPasswordAuth";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type Step = "confirmIdentity" | "setPassword" | "done";

interface ChangePasswordButtonProps {
  email: string;
}

/**
 * Changes the signed-in user's password without leaving settings: emails a
 * code (Cognito's reset code) to prove it's them, then takes the code and
 * the new password together.
 */
export const ChangePasswordButton = ({ email }: ChangePasswordButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("confirmIdentity");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const open = () => {
    setStep("confirmIdentity");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setNotice(null);
    setIsOpen(true);
  };

  const close = () => {
    if (!isBusy) setIsOpen(false);
  };

  const sendCode = async () => {
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      await requestPasswordReset(email);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      if (step === "setPassword") {
        setCode("");
        setNotice(`A new code is on its way to ${email}.`);
      } else {
        setStep("setPassword");
      }
    } catch (sendError) {
      setError(toCognitoErrorMessage(sendError, "Couldn't send the code. Please try again."));
    } finally {
      setIsBusy(false);
    }
  };

  const updatePassword = async () => {
    if (code.length !== CODE_LENGTH) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (!newPassword) {
      setError("Enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      await completePasswordReset({ email, code, newPassword });
      setStep("done");
    } catch (updateError) {
      setError(toCognitoErrorMessage(updateError, "Couldn't update your password. Please try again."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={open}>
        Change
      </Button>

      {isOpen && (
        <Modal title="Change password" onClose={isBusy ? undefined : close}>
          <div className="flex flex-col gap-3.5 p-5">
            {step === "confirmIdentity" && (
              <>
                <div className="flex items-center gap-2.5 rounded-xl border border-borderGray p-3.5">
                  <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-primaryTint text-primary">
                    <Icon name="mail" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-medium text-ink">Confirm it&apos;s you</span>
                    <span className="text-xs text-mutedGray">
                      We&apos;ll email a 6-digit code to {email}.
                    </span>
                  </div>
                </div>
                {error && <span className="text-xs text-danger">{error}</span>}
                <div className="flex">
                  <Button variant="ghost" onClick={close} disabled={isBusy}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="ml-auto" onClick={sendCode} disabled={isBusy}>
                    {isBusy ? "Sending…" : "Send code"}
                  </Button>
                </div>
              </>
            )}

            {step === "setPassword" && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                    Code sent to {email}
                  </span>
                  <VerificationCodeInput
                    length={CODE_LENGTH}
                    value={code}
                    onChange={(nextCode) => {
                      setCode(nextCode);
                      setError(null);
                    }}
                    disabled={isBusy}
                    autoFocus
                  />
                  <span className="text-center text-xs text-mutedGray">
                    Didn&apos;t get it?{" "}
                    {resendCooldown > 0 ? (
                      <span>Resend in {resendCooldown}s</span>
                    ) : (
                      <button type="button" onClick={sendCode} disabled={isBusy} className="text-primary">
                        Resend code
                      </button>
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">New password</span>
                  <Input
                    icon="lock"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                    Confirm new password
                  </span>
                  <Input
                    icon="lock"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
                {notice && !error && <span className="text-xs text-mutedGray">{notice}</span>}
                {error && <span className="text-xs text-danger">{error}</span>}
                <div className="flex">
                  <Button variant="ghost" onClick={close} disabled={isBusy}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="ml-auto" onClick={updatePassword} disabled={isBusy}>
                    {isBusy ? "Updating…" : "Update password"}
                  </Button>
                </div>
              </>
            )}

            {step === "done" && (
              <>
                <div className="flex items-center gap-2.5 rounded-xl border border-borderGray p-3.5">
                  <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-primaryTint text-primary">
                    <Icon name="check" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-medium text-ink">Password updated</span>
                    <span className="text-xs text-mutedGray">Use your new password next time you sign in.</span>
                  </div>
                </div>
                <div className="flex">
                  <Button variant="primary" className="ml-auto" onClick={close}>
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
