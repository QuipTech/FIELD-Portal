"use client";

const CREDENTIAL_STORAGE_KEY = "field-demo-platform-credential-id";

const toBase64Url = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...Array.from(new Uint8Array(buffer))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string): BufferSource => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)) as BufferSource;
};

const randomChallenge = (): BufferSource => crypto.getRandomValues(new Uint8Array(32)) as BufferSource;

const registerCredential = async (email: string): Promise<void> => {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "QuipTech FIELD", id: window.location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)) as BufferSource,
        name: email || "demo.technician@quiptech.com",
        displayName: email || "Demo Technician",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  localStorage.setItem(CREDENTIAL_STORAGE_KEY, toBase64Url(credential.rawId));
};

const verifyWithStoredCredential = async (storedCredentialId: string): Promise<void> => {
  await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      rpId: window.location.hostname,
      allowCredentials: [{ type: "public-key", id: fromBase64Url(storedCredentialId) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
};

/**
 * Demo-only biometric sign-in: there is no backend yet to issue/verify WebAuthn
 * challenges, so the first call enrolls a throwaway platform credential — which is
 * what actually triggers the OS Face ID / Touch ID prompt — and later calls reuse
 * it. A real backend must own challenge generation and signature verification
 * before this can be trusted as an actual authentication ceremony.
 */
export const signInWithPlatformAuthenticator = async (email: string): Promise<void> => {
  const storedCredentialId = localStorage.getItem(CREDENTIAL_STORAGE_KEY);

  if (storedCredentialId) {
    await verifyWithStoredCredential(storedCredentialId);
    return;
  }

  await registerCredential(email);
};
