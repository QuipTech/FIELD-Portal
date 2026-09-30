"use client";

// Must load before Amplify is configured on this page: it's what exchanges
// the ?code= Cognito sent back for tokens once configure() runs.
import "aws-amplify/auth/enable-oauth-listener";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hub } from "aws-amplify/utils";
import { getCognitoSession } from "@/lib/auth/cognitoFederatedSignIn";
import { clearPendingSignupProfile, readPendingSignupProfile } from "@/lib/auth/pendingSignupProfile";
import { saveAuthSession } from "@/lib/auth/authSession";
import { resolvePostLoginRoute } from "@/lib/auth/postLoginRouting";
import { logAuthDebug } from "@/lib/auth/authDebugLog";
import { syncCognitoSessionRequest } from "@/lib/api/authApi";
import { ApiError } from "@/lib/api/httpClient";
import type { SignupProfile } from "@/lib/types/authSession";

const SIGN_IN_FAILED_MESSAGE = "Sign-in didn't complete. Please try again.";
const PROFILE_FAILED_MESSAGE = "Couldn't create your account. Please try again.";

type SyncOutcome = "entered" | "profileRequired" | "noSession";

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export const useCompleteFederatedSignIn = () => {
  const router = useRouter();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isProfileRequired, setIsProfileRequired] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Guards against React strict mode running the effect twice in dev,
  // which would otherwise create two backend sessions.
  const hasStarted = useRef(false);

  // `profileRequired`: a first-time user whose company name + phone number
  // still has to be collected. `noSession`: nothing to sync — no Cognito
  // tokens were stored (the code exchange failed or never happened).
  const syncAndEnterPortal = async (signupProfile?: SignupProfile): Promise<SyncOutcome> => {
    // Re-read each time: Amplify refreshes the ID token if the user sat on
    // the signup dialog long enough for it to expire.
    const cognitoSession = await getCognitoSession();
    if (!cognitoSession) return "noSession";

    // An email/password sign-up saved its company + phone before verifying;
    // it's ignored if the account already exists.
    const profile = signupProfile ?? readPendingSignupProfile(cognitoSession.email);
    const response = await syncCognitoSessionRequest(cognitoSession.idToken, profile);
    logAuthDebug("Backend /auth/sync response", {
      status: response.status,
      user: response.status === "signedIn" ? response.session.user : undefined,
    });
    if (response.status === "profileRequired") return "profileRequired";

    clearPendingSignupProfile();
    saveAuthSession(response.session, cognitoSession.signInMethod);
    router.replace(resolvePostLoginRoute(response.session.user.roles));
    return "entered";
  };

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    // Read before Amplify runs: it strips ?code= from the URL once handled.
    const cameFromCognito = new URLSearchParams(window.location.search).has("code");
    let redirectFailureDetail: string | undefined;

    const stopListening = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect_failure") {
        redirectFailureDetail = payload.data?.error?.message;
        logAuthDebug("Cognito redirect failed", payload.data?.error);
      }
    });

    syncAndEnterPortal()
      .then((outcome) => {
        if (outcome === "profileRequired") setIsProfileRequired(true);
        if (outcome !== "noSession") return;
        // Opened directly (reload, bookmark, back button) with nothing to
        // finish — that's not an error, just go to the sign-in page.
        if (!cameFromCognito) {
          router.replace("/login");
          return;
        }
        setSignInError(
          redirectFailureDetail
            ? `${SIGN_IN_FAILED_MESSAGE} (${redirectFailureDetail})`
            : SIGN_IN_FAILED_MESSAGE,
        );
      })
      .catch((error: unknown) => setSignInError(toErrorMessage(error, SIGN_IN_FAILED_MESSAGE)));

    return stopListening;
    // Runs once per page load, never on re-render.
  }, []);

  const submitSignupProfile = async (signupProfile: SignupProfile) => {
    setProfileError(null);
    setIsSubmittingProfile(true);
    try {
      const outcome = await syncAndEnterPortal(signupProfile);
      if (outcome === "noSession") {
        setSignInError(SIGN_IN_FAILED_MESSAGE);
        setIsSubmittingProfile(false);
      }
    } catch (error) {
      setProfileError(toErrorMessage(error, PROFILE_FAILED_MESSAGE));
      setIsSubmittingProfile(false);
    }
  };

  return {
    signInError,
    isProfileRequired,
    isSubmittingProfile,
    profileError,
    submitSignupProfile,
  };
};
