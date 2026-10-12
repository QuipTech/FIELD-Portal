"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFlowLayout } from "@/components/auth/authFlowLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, toCognitoErrorMessage } from "@/lib/auth/cognitoPasswordAuth";
import { checkPasswordResetRequest, type PasswordResetEligibility } from "@/lib/api/authApi";
import { ApiError } from "@/lib/api/httpClient";

interface IneligibleNotice {
  message: string;
  link: { href: string; label: string };
}

const PROVIDER_LABELS = { google: "Google", apple: "Apple" } as const;

const describeIneligible = (
  eligibility: Exclude<PasswordResetEligibility, { status: "eligible" }>,
): IneligibleNotice => {
  switch (eligibility.status) {
    case "notFound":
      return {
        message: "We couldn't find an account with this email.",
        link: { href: "/register", label: "Create an account" },
      };
    case "federatedOnly": {
      const provider = PROVIDER_LABELS[eligibility.provider];
      return {
        message: `This account signs in with ${provider}, so it has no password to reset. Use “Continue with ${provider}” instead.`,
        link: { href: "/login", label: "Back to sign in" },
      };
    }
    case "unverified":
      return {
        message: "This email hasn't been verified yet. Sign in with it to get a new verification code.",
        link: { href: "/login", label: "Go to sign in" },
      };
  }
};

const ForgotPasswordPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [ineligibleNotice, setIneligibleNotice] = useState<IneligibleNotice | null>(null);

  const handleSendCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setSendError("Enter your work email.");
      return;
    }
    setSendError(null);
    setIneligibleNotice(null);
    setIsSending(true);
    try {
      const eligibility = await checkPasswordResetRequest(trimmedEmail);
      if (eligibility.status !== "eligible") {
        setIneligibleNotice(describeIneligible(eligibility));
        setIsSending(false);
        return;
      }
      await requestPasswordReset(trimmedEmail);
      router.push(`/forgot-password/verify?email=${encodeURIComponent(trimmedEmail)}`);
    } catch (error) {
      setSendError(
        error instanceof ApiError
          ? error.message
          : toCognitoErrorMessage(error, "Couldn't send the reset code. Please try again."),
      );
      setIsSending(false);
    }
  };

  return (
    <AuthFlowLayout
      icon="lock"
      title="Reset your password"
      subtitle="Enter your work email and we'll send you a 6-digit code"
      step={1}
      stepCount={3}
    >
      <div className="flex w-full flex-col gap-1.5 text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Work email</span>
        <Input
          icon="user"
          type="email"
          placeholder="j.okoye@quiptech.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setIneligibleNotice(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSendCode();
          }}
        />
      </div>
      {sendError && <span className="text-xs text-danger">{sendError}</span>}
      {ineligibleNotice && (
        <span className="text-xs text-danger">
          {ineligibleNotice.message}{" "}
          <Link href={ineligibleNotice.link.href} className="text-primary">
            {ineligibleNotice.link.label}
          </Link>
        </span>
      )}
      <Button variant="primary" className="h-11 w-full" onClick={handleSendCode} disabled={isSending}>
        {isSending ? "Sending…" : "Send reset code"}
      </Button>
      <Link href="/login" className="text-xs text-primary">
        Back to sign in
      </Link>
    </AuthFlowLayout>
  );
};

export default ForgotPasswordPage;
