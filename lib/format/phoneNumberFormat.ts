import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";
import { Metadata } from "libphonenumber-js/core";
import maxMetadata from "libphonenumber-js/metadata.max.json";
import mobileExamples from "libphonenumber-js/examples.mobile.json";

export type { CountryCode };

export interface PhoneCountryOption {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - "A".charCodeAt(0);

const toFlagEmoji = (code: CountryCode) =>
  String.fromCodePoint(...code.split("").map((letter) => letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET));

export const buildPhoneCountryOptions = (): PhoneCountryOption[] => {
  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  return getCountries()
    .map((code) => ({
      code,
      name: regionNames.of(code) ?? code,
      callingCode: getCountryCallingCode(code),
      flag: toFlagEmoji(code),
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
};

const toE164 = (country: CountryCode, digits: string) => `+${getCountryCallingCode(country)}${digits}`;

// Formats in international style with the "+<code>" stripped, since the
// country picker already shows it — e.g. PK "3001234567" → "300 1234567".
export const formatNationalDigits = (country: CountryCode, digits: string): string => {
  const callingCodePrefix = `+${getCountryCallingCode(country)}`;
  const formatted = new AsYouType().input(toE164(country, digits));
  return formatted.slice(callingCodePrefix.length).trim();
};

// The country's example mobile number with every digit shown as "-",
// e.g. US "--- --- ----", PK "--- -------".
export const buildPhonePlaceholder = (country: CountryCode): string => {
  const example = getExampleNumber(country, mobileExamples);
  if (!example) return "";
  return formatNationalDigits(country, example.nationalNumber).replace(/\d/g, "-");
};

// People type numbers the local way, e.g. PK "0300…"; the trunk "0" isn't
// dialled after "+92", so drop it. Countries where a leading 0 is part of
// the number (e.g. Italy) keep it — libphonenumber knows which is which.
export const stripNationalPrefix = (country: CountryCode, digits: string): string => {
  const formatter = new AsYouType(country);
  formatter.input(digits);
  return formatter.getNationalNumber();
};

// `numberingPlan.type()` exists at runtime but isn't in the library's types.
interface NumberingPlanWithTypes {
  type(numberType: "MOBILE" | "FIXED_LINE"): { possibleLengths(): number[] } | undefined;
}

// The country-wide limit also covers short codes and special service numbers
// (AU allows up to 12 digits), so cap at the longest mobile or landline
// number instead — AU is 9 digits.
const maxSubscriberLength = (country: CountryCode): number | undefined => {
  const metadata = new Metadata(maxMetadata);
  metadata.selectNumberingPlan(country);
  const plan = metadata.numberingPlan as unknown as NumberingPlanWithTypes | undefined;
  const lengths = (["MOBILE", "FIXED_LINE"] as const).flatMap(
    (numberType) => plan?.type(numberType)?.possibleLengths() ?? [],
  );
  return lengths.length > 0 ? Math.max(...lengths) : undefined;
};

export const isTooLongForCountry = (country: CountryCode, digits: string) => {
  const maxLength = maxSubscriberLength(country);
  if (maxLength !== undefined) return digits.length > maxLength;
  return validatePhoneNumberLength(toE164(country, digits)) === "TOO_LONG";
};

export const toPhoneNumberValue = (country: CountryCode, digits: string) => {
  const e164 = toE164(country, digits);
  return { e164, isValid: digits !== "" && isValidPhoneNumber(e164), isEmpty: digits === "" };
};

// A pasted "+92 300 …" picks its own country instead of being read as
// digits for whichever country is currently selected.
export const parseInternationalInput = (raw: string): { country: CountryCode; digits: string } | null => {
  const formatter = new AsYouType();
  formatter.input(raw);
  const country = formatter.getCountry();
  const nationalNumber = formatter.getNationalNumber();
  return country && nationalNumber ? { country, digits: nationalNumber } : null;
};
