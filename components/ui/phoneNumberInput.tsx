"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Icon } from "../icons/icon";
import {
  buildPhoneCountryOptions,
  buildPhonePlaceholder,
  formatNationalDigits,
  guessDefaultPhoneCountry,
  isTooLongForCountry,
  parseInternationalInput,
  stripNationalPrefix,
  toPhoneNumberValue,
  type CountryCode,
} from "@/lib/format/phoneNumberFormat";

export interface PhoneNumberValue {
  // Always "+<calling code><digits>", ready to send to the API.
  e164: string;
  isValid: boolean;
}

interface PhoneNumberInputProps {
  onChange: (phone: PhoneNumberValue) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  className?: string;
}

// Server render and first client render must match, so the locale-based
// guess is applied after mount.
const INITIAL_COUNTRY: CountryCode = "AU";

export const PhoneNumberInput = ({ onChange, onBlur, autoFocus, className = "" }: PhoneNumberInputProps) => {
  const countryOptions = useMemo(buildPhoneCountryOptions, []);
  const [country, setCountry] = useState<CountryCode>(INITIAL_COUNTRY);
  const [digits, setDigits] = useState("");

  useEffect(() => setCountry(guessDefaultPhoneCountry()), []);

  const selectedCountry = countryOptions.find((option) => option.code === country);
  const formattedNumber = formatNationalDigits(country, digits);

  const updatePhone = (nextCountry: CountryCode, nextDigits: string) => {
    setCountry(nextCountry);
    setDigits(nextDigits);
    onChange(toPhoneNumberValue(nextCountry, nextDigits));
  };

  const handleCountryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCountry = event.target.value as CountryCode;
    updatePhone(nextCountry, isTooLongForCountry(nextCountry, digits) ? "" : digits);
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const pasted = raw.trim().startsWith("+") ? parseInternationalInput(raw) : null;
    if (pasted) {
      updatePhone(pasted.country, pasted.digits);
      return;
    }

    let nextDigits = stripNationalPrefix(country, raw.replace(/\D/g, ""));
    // Backspacing over a space or bracket leaves the digits unchanged, and
    // reformatting would put it straight back — drop the last digit instead.
    if (nextDigits === digits && raw.length < formattedNumber.length) {
      nextDigits = digits.slice(0, -1);
    }
    if (isTooLongForCountry(country, nextDigits)) return;
    updatePhone(country, nextDigits);
  };

  return (
    <div
      className={`flex h-10 shrink-0 items-center rounded-lg border border-borderGrayStrong bg-surface ${className}`}
    >
      <div className="relative flex h-full flex-none items-center gap-1.5 border-r border-borderGray pl-3 pr-2 text-[15px] text-ink">
        <span aria-hidden="true">{selectedCountry?.flag}</span>
        <span>+{selectedCountry?.callingCode}</span>
        <Icon name="chevd" className="h-4 w-4 stroke-mutedGray" />
        {/* Invisible native select over the trigger: full keyboard, screen
            reader and mobile-picker support without a custom listbox. */}
        <select
          aria-label="Country"
          value={country}
          onChange={handleCountryChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {countryOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.flag} {option.name} (+{option.callingCode})
            </option>
          ))}
        </select>
      </div>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label="Phone number"
        placeholder={buildPhonePlaceholder(country)}
        value={formattedNumber}
        onChange={handleNumberChange}
        onBlur={onBlur}
        autoFocus={autoFocus}
        className="h-full w-full flex-1 border-none bg-transparent px-3 text-[15px] text-ink outline-none placeholder:text-mutedGray"
      />
    </div>
  );
};
