import type { Metadata } from "next";
import localFont from "next/font/local";
import { IconSprite } from "@/components/icons/iconSprite";
import { themeInitScript } from "@/lib/theme/themePreference";
import "./globals.css";
import { PersonalPaymentPrompt } from "@/components/billing/personalPaymentPrompt";

// Bundled (SIL OFL, see fonts/IBMPlexSans-LICENSE.txt) rather than loaded
// with next/font/google, which downloads the font during `next build` and
// fails the build whenever Google Fonts can't be reached.
const ibmPlexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuipTech FIELD Portal",
  description: "User Portal and Admin Console for QuipTech FIELD.",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    // suppressHydrationWarning: the <head> script may add the "dark" class
    // before React hydrates, which is expected.
    <html lang="en" className={ibmPlexSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-surface font-sans text-[16px] leading-[1.55] text-ink">
        <IconSprite />
        {children}
        <PersonalPaymentPrompt />
      </body>
    </html>
  );
};

export default RootLayout;
