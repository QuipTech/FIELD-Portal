"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFlowLayout } from "@/components/auth/authFlowLayout";
import { VerificationCodeInput } from "@/components/auth/verificationCodeInput";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/errorToast";
import { confirmEmailCode, resendEmailCode, toCognitoErrorMessage } from "@/lib/auth/cognitoPasswordAuth";

const CODE_LENGTH = 6;
// Spaces out resends; Cognito also rate-limits them on its side.
const RESEND_COOLDOWN_SECONDS = 60;

const VerifyEmailForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  // Arriving straight from sign-up means a code was just sent; from login,
  // the last one may have expired, so resending is allowed immediately.
  const [resendCooldown, setResendCooldown] = useState(
    searchParams.get("sent") === "1" ? RESEND_COOLDOWN_SECONDS : 0,
  );
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async (submittedCode = code) => {
    if (submittedCode.length !== CODE_LENGTH || isVerifying) return;
    setCodeError(null);
    setNotice(null);
    setIsVerifying(true);
    try {
      const isSignedIn = await confirmEmailCode(email, submittedCode);
      // Signed in: /auth/callback creates the FIELD account. Otherwise
      // (e.g. the page was reloaded since sign-up) they sign in themselves.
      router.push(
        isSignedIn ? "/auth/callback" : `/login?verified=1&email=${encodeURIComponent(email)}`,
      );
    } catch (error) {
      setCodeError(toCognitoErrorMessage(error, "Couldn't verify the code. Please try again."));
      setCode("");
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setCodeError(null);
    setNotice(null);
    setIsResending(true);
    try {
      await resendEmailCode(email);
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
      <AuthFlowLayout
        icon="mail"
        title="Check your email"
        subtitle="We couldn't tell which email to verify. Please sign up again."
        step={2}
        stepCount={2}
      >
        <Link href="/register" className="text-xs text-primary">
          Back to sign up
        </Link>
      </AuthFlowLayout>
    );
  }

  return (
    <AuthFlowLayout
      icon="mail"
      title="Check your email"
      subtitle={`Enter the 6-digit code we sent to ${email} to finish creating your account.`}
      step={2}
      stepCount={2}
    >
      <VerificationCodeInput
        length={CODE_LENGTH}
        value={code}
        onChange={(nextCode) => {
          setCode(nextCode);
          setCodeError(null);
        }}
        onComplete={handleVerify}
        hasError={Boolean(codeError)}
        disabled={isVerifying}
        autoFocus
      />
      {codeError && <span className="text-xs text-danger">{codeError}</span>}
      {notice && <span className="text-xs text-mutedGray">{notice}</span>}
      <Button
        variant="primary"
        className="h-11 w-full"
        onClick={() => handleVerify()}
        disabled={code.length !== CODE_LENGTH || isVerifying}
      >
        {isVerifying ? "Verifying…" : "Verify email"}
      </Button>
      <span className="text-xs text-mutedGray">
        Didn&apos;t get it? Check your spam folder, or{" "}
        {resendCooldown > 0 ? (
          <span>resend in {resendCooldown}s</span>
        ) : (
          <button type="button" onClick={handleResend} disabled={isResending} className="text-primary">
            {isResending ? "sending…" : "resend code"}
          </button>
        )}
      </span>
      <Link href="/register" className="text-xs text-primary">
        Wrong email? Go back
      </Link>
      {toast && <ErrorToast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </AuthFlowLayout>
  );
};

// useSearchParams needs a Suspense boundary in the app router.
const VerifyEmailPage = () => (
  <Suspense>
    <VerifyEmailForm />
  </Suspense>
);

export default VerifyEmailPage;
