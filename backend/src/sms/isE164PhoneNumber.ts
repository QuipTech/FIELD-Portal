// +, a country code that doesn't start with 0, then up to 15 digits in
// all, e.g. +61412345678.
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export const isE164PhoneNumber = (value: string): boolean =>
  E164_PATTERN.test(value);
