import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";
import mobileExamples from "libphonenumber-js/examples.mobile.json";

export type { CountryCode };

export interface PhoneCountryOption {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

// QuipTech's home market, used when the browser locale names no country.
const FALLBACK_COUNTRY: CountryCode = "AU";
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

export const guessDefaultPhoneCountry = (): CountryCode => {
  const supported = new Set<string>(getCountries());
  const localeRegion = navigator.languages
    .map((locale) => new Intl.Locale(locale).region)
    .find((region) => region && supported.has(region));
  return (localeRegion as CountryCode | undefined) ?? FALLBACK_COUNTRY;
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

export const isTooLongForCountry =(country: CountryCode, digits: string) =>
  validatePhoneNumberLength(toE164(country, digits)) === "TOO_LONG";

export const toPhoneNumberValue = (country: CountryCode, digits: string) => {
  const e164 = toE164(country, digits);
  return { e164, isValid: digits !== "" && isValidPhoneNumber(e164) };
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
