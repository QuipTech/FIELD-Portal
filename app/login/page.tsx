"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { AuthVisual } from "@/components/auth/authVisual";
import { AuthPanelBackground } from "@/components/auth/authPanelBackground";
import { OrDivider } from "@/components/auth/orDivider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resolvePostLoginRoute } from "@/lib/auth/postLoginRouting";
import { usePlatformAuthenticator } from "@/lib/auth/usePlatformAuthenticator";
import { signInWithPlatformAuthenticator } from "@/lib/auth/webauthnPlatformCredential";
import { getStoredUser, saveAuthSession } from "@/lib/auth/authSession";
import { loginRequest } from "@/lib/api/authApi";
import { ApiError } from "@/lib/api/httpClient";
import { OauthButtons } from "./components/oauthButtons";
import { AppDownloadLinks } from "./components/appDownloadLinks";

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isBiometricPending, setIsBiometricPending] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const hasPlatformAuthenticator = usePlatformAuthenticator();

  const handleSignIn = async () => {
    setLoginError(null);
    setIsSubmitting(true);
    try {
      const session = await loginRequest({ email, password });
      saveAuthSession(session);
      router.push(resolvePostLoginRoute(session.user.roles));
    } catch (error) {
      setLoginError(error instanceof ApiError ? error.message : "Couldn't sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometricSignIn = async () => {
    setBiometricError(null);
    setIsBiometricPending(true);
    try {
      await signInWithPlatformAuthenticator(email);
      router.push(resolvePostLoginRoute(getStoredUser()?.roles));
    } catch {
      setBiometricError(
        "Face ID / Touch ID sign-in was cancelled or didn't complete.",
      );
    } finally {
      setIsBiometricPending(false);
    }
  };

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
          <Image
            src="/quiptechFieldLogo.png"
            alt="QuipTech FIELD"
            width={200}
            height={67}
            className="h-10 w-auto dark:brightness-0 dark:invert"
          />
          <span className="text-xs text-mutedGray">
            Sign in with your work account
          </span>
          <div className="flex w-[296px] flex-col gap-3.5">
            <OauthButtons />
            <OrDivider label="or with work email" />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                Work email
              </span>
              <Input
                icon="user"
                type="email"
                placeholder="j.okoye@quiptech.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                Password
              </span>
              <Input
                icon="lock"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {loginError && (
              <span className="text-center text-xs text-danger">{loginError}</span>
            )}
            <Button
              variant="primary"
              className="h-11 w-full"
              onClick={handleSignIn}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
            <span className="text-center text-xs text-mutedGray">
              New to QuipTech FIELD?{" "}
              <Link href="/register" className="text-primary">
                Create an account
              </Link>
            </span>
            <div className="flex justify-center gap-2.5 text-xs text-mutedGray">
              <Link href="#" className="text-primary">
                Single sign-on
              </Link>
              <span>·</span>
              <Link href="/forgot-password" className="text-primary">
                Forgot password
              </Link>
            </div>
            {hasPlatformAuthenticator && (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleBiometricSignIn}
                  disabled={isBiometricPending}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-borderGrayStrong bg-surface text-[15px] font-medium text-ink disabled:opacity-60"
                >
                  <Icon name="faceid" />
                  {isBiometricPending
                    ? "Waiting for Face ID / Touch ID…"
                    : "Sign in with Face ID / Touch ID"}
                </button>
                {biometricError && (
                  <span className="text-center text-xs text-danger">
                    {biometricError}
                  </span>
                )}
              </div>
            )}
            <AppDownloadLinks />
          </div>
          <p className="max-w-[44ch] text-center text-xs text-mutedGray">
            One login for all internal staff, lands in the technician or admin
            view by role.
          </p>
        </div>
      </AuthPanelBackground>
    </div>
  );
};

export default LoginPage;
