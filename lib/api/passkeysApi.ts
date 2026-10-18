import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { apiRequest } from "./httpClient";
import type { AuthSession } from "../types/authSession";

export interface Passkey {
  id: string;
  deviceName: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

// Each ceremony is options (with a single-use challenge) → device prompt → result.
interface CeremonyOptions<T> {
  challengeId: string;
  options: T;
}

const authorised = (token: string) => ({ Authorization: `Bearer ${token}` });

export const passkeySignInOptionsRequest = () =>
  apiRequest<CeremonyOptions<PublicKeyCredentialRequestOptionsJSON>>("/auth/passkeys/sign-in/options", {
    method: "POST",
  });

export const finishPasskeySignInRequest = (challengeId: string, response: AuthenticationResponseJSON) =>
  apiRequest<AuthSession>("/auth/passkeys/sign-in", {
    method: "POST",
    body: JSON.stringify({ challengeId, response }),
  });

export const listPasskeysRequest = (token: string) =>
  apiRequest<Passkey[]>("/auth/passkeys", { headers: authorised(token) });

export const passkeyRegistrationOptionsRequest = (token: string) =>
  apiRequest<CeremonyOptions<PublicKeyCredentialCreationOptionsJSON>>("/auth/passkeys/registration/options", {
    method: "POST",
    headers: authorised(token),
  });

export const finishPasskeyRegistrationRequest = (
  token: string,
  challengeId: string,
  response: RegistrationResponseJSON,
  deviceName: string,
) =>
  apiRequest<Passkey>("/auth/passkeys/registration", {
    method: "POST",
    headers: authorised(token),
    body: JSON.stringify({ challengeId, response, deviceName }),
  });

export const deletePasskeyRequest = (token: string, id: string) =>
  apiRequest(`/auth/passkeys/${id}`, { method: "DELETE", headers: authorised(token) });
