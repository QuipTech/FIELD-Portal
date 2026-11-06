"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AuthPanelBackground } from "@/components/auth/authPanelBackground";

// The mobile app's scheme (app.config.js SCHEME). Same in every build.
const APP_SCHEME = process.env.NEXT_PUBLIC_MOBILE_APP_SCHEME ?? "quiptechfield";

// Stripe returns mobile payers and Customer Portal visits here (the API sets
// it when the app asks with returnTo: 'app'), because Stripe only accepts
// https return URLs. Hands straight back to the app; its in-app browser
// closes on the app's scheme. Nothing here confirms payment: the app asks
// the API, which asks Stripe.
const AppReturnBillingPage = () => {
  const [appUrl, setAppUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = `${APP_SCHEME}://billing-return${window.location.search}`;
    setAppUrl(url);
    window.location.replace(url);
  }, []);

  return (
    <div className="flex min-h-screen">
      <AuthPanelBackground>
        <div className="flex h-full flex-col items-center justify-center gap-5 p-10 text-center">
          <Image
            src="/quiptechFieldLogo.png"
            alt="QuipTech FIELD"
            width={200}
            height={67}
            className="h-10 w-auto dark:brightness-0 dark:invert"
          />
          <p className="text-base">Returning to the FIELD app…</p>
          {appUrl && (
            <a
              href={appUrl}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Open the FIELD app
            </a>
          )}
        </div>
      </AuthPanelBackground>
    </div>
  );
};

export default AppReturnBillingPage;
