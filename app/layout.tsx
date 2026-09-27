import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { IconSprite } from "@/components/icons/iconSprite";
import { themeInitScript } from "@/lib/theme/themePreference";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      </body>
    </html>
  );
};

export default RootLayout;
