"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFlowLayout } from "@/components/auth/authFlowLayout";
import { VerificationCodeInput } from "@/components/auth/verificationCodeInput";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/errorToast";
import { requestPasswordReset, toCognitoErrorMessage } from "@/lib/auth/cognitoPasswordAuth";
import { savePasswordResetCode } from "@/lib/auth/passwordResetCode";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

const VerifyResetCodeForm = () => {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [code, setCode] = useState("");
  // The previous step has just sent a code.
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Cognito checks the code with the new password, on the next step.
  const handleContinue = (submittedCode = code) => {
    if (submittedCode.length !== CODE_LENGTH) return;
    savePasswordResetCode(submittedCode);
    router.push(`/forgot-password/reset?email=${encodeURIComponent(email)}`);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setNotice(null);
    setIsResending(true);
    try {
      await requestPasswordReset(email);
      setCode("");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice(`A new code is on its way to ${email}.`);
    } catch (error) {
      setToast({
        id: Date.now(),
        message: toCognitoErrorMessage(error, "Couldn't send a new code. Please try again."),
      });
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return (
      <AuthFlowLayout icon="shield" title="Enter the code" subtitle="Start again from your work email." step={2} stepCount={3}>
        <Link href="/forgot-password" className="text-xs text-primary">
          Back
        </Link>
      </AuthFlowLayout>
    );
  }

  return (
    <AuthFlowLayout
      icon="shield"
      title="Enter the code"
      subtitle={`We sent a 6-digit code to ${email}`}
      step={2}
      stepCount={3}
    >
      <VerificationCodeInput
        length={CODE_LENGTH}
        value={code}
        onChange={setCode}
        onComplete={handleContinue}
        autoFocus
      />
      {notice && <span className="text-xs text-mutedGray">{notice}</span>}
      <span className="text-xs text-mutedGray">
        Didn&apos;t get it?{" "}
        {resendCooldown > 0 ? (
          <span>Resend in {resendCooldown}s</span>
        ) : (
          <button type="button" onClick={handleResend} disabled={isResending} className="text-primary">
            {isResending ? "Sending…" : "Resend code"}
          </button>
        )}
      </span>
      <Button
        variant="primary"
        className="h-11 w-full"
        onClick={() => handleContinue()}
        disabled={code.length !== CODE_LENGTH}
      >
        Verify code
      </Button>
      {toast && <ErrorToast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </AuthFlowLayout>
  );
};

// useSearchParams needs a Suspense boundary in the app router.
const VerifyCodePage = () => (
  <Suspense>
    <VerifyResetCodeForm />
  </Suspense>
);

export default VerifyCodePage;
