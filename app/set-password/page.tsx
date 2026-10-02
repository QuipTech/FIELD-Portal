"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFlowLayout } from "@/components/auth/authFlowLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthError } from "aws-amplify/auth";
import { completeFirstSignIn, toCognitoErrorMessage } from "@/lib/auth/cognitoPasswordAuth";

// Amplify forgets the pending sign-in on reload; they must start again.
const EXPIRED_MESSAGE = "This sign-in has timed out. Sign in again with the temporary password from your email.";

// An invited user's first sign-in: replace the temporary password Cognito
// emailed them, then continue to their portal like any other sign-in.
const SetPasswordForm = () => {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const handleSave = async () => {
    if (!password) {
      setSaveError("Choose a password.");
      return;
    }
    if (password !== confirmPassword) {
      setSaveError("Passwords don't match.");
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      if (await completeFirstSignIn(password)) {
        router.push("/auth/callback");
        return;
      }
      setSaveError("Couldn't finish signing in. Please sign in again.");
    } catch (error) {
      // Amplify reports a missing pending sign-in as SignInException.
      const hasNoPendingSignIn = error instanceof AuthError && error.name === "SignInException";
      setIsExpired(hasNoPendingSignIn);
      setSaveError(hasNoPendingSignIn ? EXPIRED_MESSAGE : toCognitoErrorMessage(error, "Couldn't set your password. Please try again."));
    }
    setIsSaving(false);
  };

  return (
    <AuthFlowLayout
      icon="lock"
      title="Choose your password"
      subtitle={email ? `Welcome to FIELD. Set a password for ${email}.` : "Welcome to FIELD. Set your password."}
      step={1}
      stepCount={1}
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
      {isExpired && (
        <Link href={email ? `/login?email=${encodeURIComponent(email)}` : "/login"} className="text-xs text-primary">
          Back to sign in
        </Link>
      )}
      <Button variant="primary" className="h-11 w-full" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving…" : "Set password and continue"}
      </Button>
    </AuthFlowLayout>
  );
};

// useSearchParams needs a Suspense boundary in the app router.
const SetPasswordPage = () => (
  <Suspense>
    <SetPasswordForm />
  </Suspense>
);

export default SetPasswordPage;
