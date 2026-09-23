"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthVisual } from "@/components/auth/authVisual";
import { AuthPanelBackground } from "@/components/auth/authPanelBackground";
import { OrDivider } from "@/components/auth/orDivider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resolvePostLoginRoute } from "@/lib/auth/demoLoginRouting";
import { saveAuthSession } from "@/lib/auth/authSession";
import { registerRequest } from "@/lib/api/authApi";
import { ApiError } from "@/lib/api/httpClient";
import { OauthButtons } from "../login/components/oauthButtons";

interface RegisterFormState {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phoneNumber: string;
  password: string;
}

const INITIAL_FORM_STATE: RegisterFormState = {
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phoneNumber: "",
  password: "",
};

const RegisterPage = () => {
  const router = useRouter();
  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM_STATE);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const updateField =
    (field: keyof RegisterFormState) => (event: ChangeEvent<HTMLInputElement>) =>
      setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const handleCreateAccount = async () => {
    if (!agreedToTerms) {
      setRegisterError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setRegisterError(null);
    setIsSubmitting(true);
    try {
      const session = await registerRequest({
        firstName: form.firstName,
        lastName: form.lastName,
        companyName: form.companyName,
        email: form.email,
        phoneNumber: form.phoneNumber || undefined,
        password: form.password,
      });
      saveAuthSession(session);
      router.push(resolvePostLoginRoute(form.email));
    } catch (error) {
      setRegisterError(
        error instanceof ApiError ? error.message : "Couldn't create your account. Please try again.",
      );
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
                <Input
                  icon="life"
                  type="tel"
                  placeholder="+61 412 345 678"
                  value={form.phoneNumber}
                  onChange={updateField("phoneNumber")}
                />
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
            <Button
              variant="primary"
              className="h-11"
              onClick={handleCreateAccount}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account…" : "Create account"}
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
    </div>
  );
};

export default RegisterPage;
