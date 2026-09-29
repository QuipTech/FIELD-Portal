"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AuthPanelBackground } from "@/components/auth/authPanelBackground";
import { signOutOfCognito } from "@/lib/auth/cognitoFederatedSignIn";
import { useCompleteFederatedSignIn } from "./useCompleteFederatedSignIn";
import { SignupProfileDialog } from "./components/signupProfileDialog";

const AuthCallbackPage = () => {
  const { signInError, isProfileRequired, isSubmittingProfile, profileError, submitSignupProfile } =
    useCompleteFederatedSignIn();

  // Signing out of Cognito (rather than just linking to /login) drops the
  // Google/Apple session, so the next attempt can pick a different account.
  const handleBackToSignIn = () => {
    signOutOfCognito().catch(() => window.location.assign("/login"));
  };

  return (
    <div className="flex min-h-screen">
      <AuthPanelBackground>
        <div className="flex h-full flex-col items-center justify-center gap-5 p-10">
          <Image
            src="/quiptechFieldLogo.png"
            alt="QuipTech FIELD"
            width={200}
            height={67}
            className="h-10 w-auto dark:brightness-0 dark:invert"
          />
          {signInError ? (
            <div className="flex w-[296px] flex-col gap-3.5">
              <span className="text-center text-xs text-danger">{signInError}</span>
              <Button variant="primary" className="h-11 w-full" onClick={handleBackToSignIn}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <span className="text-xs text-mutedGray">Signing you in…</span>
          )}
        </div>
      </AuthPanelBackground>
      {isProfileRequired && !signInError && (
        <SignupProfileDialog
          isSubmitting={isSubmittingProfile}
          submitError={profileError}
          onSubmit={submitSignupProfile}
          onCancel={handleBackToSignIn}
        />
      )}
    </div>
  );
};

export default AuthCallbackPage;
