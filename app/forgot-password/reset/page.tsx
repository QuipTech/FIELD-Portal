"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFlowLayout } from "@/components/auth/authFlowLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthError } from "aws-amplify/auth";
import { completePasswordReset, toCognitoErrorMessage } from "@/lib/auth/cognitoPasswordAuth";
import { clearPasswordResetCode, readPasswordResetCode } from "@/lib/auth/passwordResetCode";

// Errors that mean the code, not the password, was the problem.
const CODE_ERRORS = new Set(["CodeMismatchException", "ExpiredCodeException"]);

const NewPasswordForm = () => {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCodeRejected, setIsCodeRejected] = useState(false);

  const handleUpdatePassword = async () => {
    const code = readPasswordResetCode();
    if (!email || !code) {
      setIsCodeRejected(true);
      setSaveError("Your reset code is missing. Enter it again.");
      return;
    }
    if (!password) {
      setSaveError("Enter a new password.");
      return;
    }
    if (password !== confirmPassword) {
      setSaveError("Passwords don't match.");
      return;
    }
    setSaveError(null);
    setIsCodeRejected(false);
    setIsSaving(true);
    try {
      await completePasswordReset({ email, code, newPassword: password });
      clearPasswordResetCode();
      router.push(`/login?reset=1&email=${encodeURIComponent(email)}`);
    } catch (error) {
      setIsCodeRejected(error instanceof AuthError && CODE_ERRORS.has(error.name));
      setSaveError(toCognitoErrorMessage(error, "Couldn't update your password. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <AuthFlowLayout
      icon="check"
      title="Set a new password"
      subtitle={email ? `Choose a new password for ${email}` : "Choose a new password"}
      step={3}
      stepCount={3}
    >
      <div className="flex w-full flex-col gap-1.5 text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">New password</span>
        <Input
          icon="lock"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="flex w-full flex-col gap-1.5 text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Confirm password</span>
        <Input
          icon="lock"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      {saveError && <span className="text-xs text-danger">{saveError}</span>}
      {isCodeRejected && (
        <Link
          href={email ? `/forgot-password/verify?email=${encodeURIComponent(email)}` : "/forgot-password"}
          className="text-xs text-primary"
        >
          Enter the code again
        </Link>
      )}
      <Button variant="primary" className="h-11 w-full" onClick={handleUpdatePassword} disabled={isSaving}>
        {isSaving ? "Updating…" : "Update password"}
      </Button>
    </AuthFlowLayout>
  );
};

// useSearchParams needs a Suspense boundary in the app router.
const NewPasswordPage = () => (
  <Suspense>
    <NewPasswordForm />
  </Suspense>
);

export default NewPasswordPage;
