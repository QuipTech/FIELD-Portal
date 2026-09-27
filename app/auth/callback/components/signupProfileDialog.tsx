"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhoneNumberInput, type PhoneNumberValue } from "@/components/ui/phoneNumberInput";
import type { SignupProfile } from "@/lib/types/authSession";

interface SignupProfileDialogProps {
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (profile: SignupProfile) => void;
  onCancel: () => void;
}

export const SignupProfileDialog = ({
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
}: SignupProfileDialogProps) => {
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState<PhoneNumberValue>({ e164: "", isValid: false });
  const [isPhoneTouched, setIsPhoneTouched] = useState(false);
  const isComplete = companyName.trim() !== "" && phone.isValid;
  const showPhoneError = isPhoneTouched && !phone.isValid;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isComplete) return;
    onSubmit({ companyName: companyName.trim(), phoneNumber: phone.e164 });
  };

  return (
    <Modal title="Finish setting up your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <span className="text-xs text-mutedGray">
          First time here? Tell us where you work so we can create your FIELD workspace.
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
            Company name
          </span>
          <Input
            placeholder="QuipTech Mining"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            required
            autoFocus
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
            <span className="text-xs text-danger">Enter a valid phone number for the selected country.</span>
          )}
        </div>
        {submitError && <span className="text-center text-xs text-danger">{submitError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="ml-auto"
            disabled={!isComplete || isSubmitting}
          >
            {isSubmitting ? "Creating account…" : "Continue"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
