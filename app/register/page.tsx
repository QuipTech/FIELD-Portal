"use client";

import { useCallback, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthVisual } from "@/components/auth/authVisual";
import { AuthPanelBackground } from "@/components/auth/authPanelBackground";
import { OrDivider } from "@/components/auth/orDivider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/errorToast";
import { PhoneNumberInput, type PhoneNumberValue } from "@/components/ui/phoneNumberInput";
import { signUpWithEmail, toCognitoErrorMessage } from "@/lib/auth/cognitoPasswordAuth";
import { savePendingSignupProfile } from "@/lib/auth/pendingSignupProfile";
import { OauthButtons } from "../login/components/oauthButtons";

interface RegisterFormState {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const INITIAL_FORM_STATE: RegisterFormState = {
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const RegisterPage = () => {
  const router = useRouter();
  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM_STATE);
  const [phone, setPhone] = useState<PhoneNumberValue>({ e164: "", isValid: false, isEmpty: true });
  const [isPhoneTouched, setIsPhoneTouched] = useState(false);
  const [isConfirmPasswordTouched, setIsConfirmPasswordTouched] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  // `id` changes on every raise so a repeated message restarts the toast.
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = (message: string) => setToast({ id: Date.now(), message });

  const updateField =
    (field: keyof RegisterFormState) => (event: ChangeEvent<HTMLInputElement>) =>
      setForm((previous) => ({ ...previous, [field]: event.target.value }));

  // Required, as for Google/Apple sign-ups: the account is created with it.
  const isPhoneInvalid = !phone.isValid;
  const showPhoneError = isPhoneTouched && isPhoneInvalid;
  const hasRequiredDetails = [form.firstName, form.lastName, form.companyName, form.email].every(
    (value) => value.trim() !== "",
  );

  const doPasswordsMatch = form.password === form.confirmPassword;
  const showConfirmPasswordError = isConfirmPasswordTouched && !doPasswordsMatch;

  const handleCreateAccount = async () => {
    if (!agreedToTerms) {
      showToast("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    if (!hasRequiredDetails) {
      showToast("Fill in your name, company and work email.");
      return;
    }
    if (isPhoneInvalid) {
      setIsPhoneTouched(true);
      showToast("Enter a valid phone number for the selected country.");
      return;
    }
    if (!doPasswordsMatch) {
      setIsConfirmPasswordTouched(true);
      showToast("Passwords don't match.");
      return;
    }
    setToast(null);
    setRegisterError(null);
    setIsSubmitting(true);
    const email = form.email.trim();
    try {
      // Cognito creates the login and emails the code; the FIELD account is
      // created after verification, from /auth/callback.
      await signUpWithEmail({
        email,
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });
      savePendingSignupProfile(email, { companyName: form.companyName.trim(), phoneNumber: phone.e164 });
      router.push(`/verify-email?email=${encodeURIComponent(email)}&sent=1`);
    } catch (error) {
      setRegisterError(toCognitoErrorMessage(error, "Couldn't create your account. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <AuthVisual
        heading="Every technician, every machine, one system of record."
        subtext="Start a self-serve pilot in minutes — no card required to explore the demo."
      />
      <AuthPanelBackground>
        <div className="flex h-full items-center justify-center p-10">
          <div className="flex w-full max-w-[420px] flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <h1 className="text-[22px] font-medium text-ink">
                Create your account
              </h1>
              <span className="text-xs text-mutedGray">
                Set up QuipTech FIELD for your team
              </span>
            </div>
            <OauthButtons />
            <OrDivider label="or with work email" />
            <div className="flex flex-col gap-3">
              <div className="flex gap-2.5">
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                    First name
                  </span>
                  <Input placeholder="Jo" value={form.firstName} onChange={updateField("firstName")} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                    Last name
                  </span>
                  <Input placeholder="Okoye" value={form.lastName} onChange={updateField("lastName")} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                  Company name
                </span>
                <Input
                  icon="db"
                  placeholder="QuipTech Mining"
                  value={form.companyName}
                  onChange={updateField("companyName")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                  Work email
                </span>
                <Input
                  icon="user"
                  type="email"
                  placeholder="j.okoye@quiptech.com"
                  value={form.email}
                  onChange={updateField("email")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                  Phone number
                </span>
                <PhoneNumberInput
                  onChange={setPhone}
                  onBlur={() => setIsPhoneTouched(true)}
                  className={showPhoneError ? "border-danger" : ""}
                />
                {showPhoneError && (
                  <span className="text-xs text-danger">
                    Enter a valid phone number for the selected country.
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                  Password
                </span>
                <Input
                  icon="lock"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={updateField("password")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
                  Confirm password
                </span>
                <Input
                  icon="lock"
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={updateField("confirmPassword")}
                  onBlur={() => setIsConfirmPasswordTouched(true)}
                  className={showConfirmPasswordError ? "border-danger" : ""}
                />
                {showConfirmPasswordError && (
                  <span className="text-xs text-danger">Passwords don&apos;t match.</span>
                )}
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-mutedGray">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(event) => setAgreedToTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none rounded border-borderGrayStrong"
              />
              I agree to the Terms of Service and Privacy Policy
            </label>
            {registerError && (
              <span className="text-center text-xs text-danger">{registerError}</span>
            )}
            {/* Not `disabled` until terms are agreed: it only looks disabled,
                so a click can still explain why nothing happened. */}
            <Button
              variant="primary"
              className={`h-11 ${agreedToTerms ? "" : "cursor-not-allowed opacity-50 hover:bg-primary"}`}
              aria-disabled={!agreedToTerms}
              onClick={handleCreateAccount}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending code…" : "Create account"}
            </Button>
            <span className="text-center text-xs text-mutedGray">
              Already have an account?{" "}
              <Link href="/login" className="text-primary">
                Sign in
              </Link>
            </span>
          </div>
        </div>
      </AuthPanelBackground>
      {toast && <ErrorToast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  );
};

export default RegisterPage;
