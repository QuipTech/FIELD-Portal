"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  finishPasskeyRegistrationRequest,
  finishPasskeySignInRequest,
  passkeyRegistrationOptionsRequest,
  passkeySignInOptionsRequest,
} from "../api/passkeysApi";
import { ApiError } from "../api/httpClient";
import { requireAccessToken } from "../api/requireAccessToken";
import { getStoredProfile, getStoredSignInMethod, saveAuthSession } from "./authSession";
import type { AuthSession, SignInMethod } from "../types/authSession";

// Remembers, per account, how it normally signs in (password or Google/Apple),
// so a passkey sign-in shows the same settings, e.g. no password options
// for a Google account.
const METHOD_KEY_PREFIX = "field.passkeySignInMethod.";
const rememberSignInMethod = (userId: string, method: SignInMethod) => {
  try {
    window.localStorage.setItem(`${METHOD_KEY_PREFIX}${userId}`, method);
  } catch {
    // Only affects which settings show; sign-in still works without it.
  }
};
const recalledSignInMethod = (userId: string): SignInMethod => {
  try {
    return window.localStorage.getItem(`${METHOD_KEY_PREFIX}${userId}`) === "federated" ? "federated" : "password";
  } catch {
    return "password";
  }
};

// A short label for the settings list, e.g. "Chrome on Mac".
export const describeThisDevice = (): string => {
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent)
          ? "Safari"
          : "Browser";
  const system = /iPhone/.test(agent)
    ? "iPhone"
    : /iPad/.test(agent)
      ? "iPad"
      : /Android/.test(agent)
        ? "Android"
        : /Mac OS X/.test(agent)
          ? "Mac"
          : /Windows/.test(agent)
            ? "Windows"
            : "this device";
  return `${browser} on ${system}`;
};

// What to tell someone when the device prompt or the server says no.
export const toPasskeyErrorMessage = (error: unknown, fallback: string): string => {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") return "Face ID / Touch ID was cancelled or timed out.";
  if (name === "InvalidStateError") return "This device is already set up for your account.";
  if (error instanceof ApiError) return error.message;
  return fallback;
};

// Sets up this device's Face ID / Touch ID for the signed-in account.
export const registerThisDevice = async () => {
  const token = requireAccessToken();
  const { challengeId, options } = await passkeyRegistrationOptionsRequest(token);
  const response = await startRegistration({ optionsJSON: options });
  const saved = await finishPasskeyRegistrationRequest(token, challengeId, response, describeThisDevice());
  const profile = getStoredProfile();
  if (profile) rememberSignInMethod(profile.user.id, getStoredSignInMethod());
  return saved;
};

// No email needed: the device offers the accounts set up on it, and signing
// the server's challenge proves which one.
export const signInWithPasskey = async (): Promise<AuthSession> => {
  const { challengeId, options } = await passkeySignInOptionsRequest();
  const response = await startAuthentication({ optionsJSON: options });
  const session = await finishPasskeySignInRequest(challengeId, response);
  saveAuthSession(session, recalledSignInMethod(session.user.id));
  return session;
};
