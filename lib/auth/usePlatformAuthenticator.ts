"use client";

import { useEffect, useState } from "react";

/**
 * True only when the device exposes a platform authenticator (Face ID, Touch ID,
 * Windows Hello, etc). Starts false so the button stays hidden until the async
 * WebAuthn check resolves, avoiding a flash on devices without biometrics.
 */
export const usePlatformAuthenticator = () => {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAvailability = async () => {
      const canCheck = typeof window !== "undefined" && !!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
      if (!canCheck) return;

      try {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!cancelled) setIsAvailable(available);
      } catch {
        if (!cancelled) setIsAvailable(false);
      }
    };

    checkAvailability();
    return () => {
      cancelled = true;
    };
  }, []);

  return isAvailable;
};
