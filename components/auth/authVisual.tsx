import type { ReactNode } from "react";
import Image from "next/image";

interface AuthVisualProps {
  heading: ReactNode;
  subtext: string;
}

export const AuthVisual = ({ heading, subtext }: AuthVisualProps) => {
  return (
    <div className="relative hidden flex-[1.15] flex-col overflow-hidden bg-ink p-10 md:flex">
      <Image
        src="/images/loginAuthVisual.jpg"
        alt="A field technician using an AR headset to review live diagnostics on a machine"
        fill
        priority
        sizes="(min-width: 768px) 46vw, 100vw"
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary via-primaryHover/90 to-[#0E7A6C] opacity-70 mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#8B7CF0]/50 via-transparent to-[#2CB8A6]/45 mix-blend-screen" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-[320px] w-[320px] rounded-full bg-[#FF7A45] opacity-50 blur-[90px] mix-blend-screen" />
      <div className="pointer-events-none absolute -right-10 top-1/3 h-[300px] w-[300px] rounded-full bg-[#2CB8A6] opacity-50 blur-[90px] mix-blend-screen" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/65 via-black/10 to-transparent" />
      <div className="relative z-10 flex flex-col gap-6">
        <div className="inline-flex self-start rounded-[10px] bg-white px-3 py-2 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.25)]">
          <Image src="/quiptechFieldLogo.png" alt="QuipTech FIELD" width={140} height={47} className="h-[22px] w-auto" />
        </div>
        <div className="flex max-w-[420px] flex-col gap-2.5">
          <div className="text-[32px] font-medium leading-tight text-white">{heading}</div>
          <div className="text-[15px] text-white/75">{subtext}</div>
        </div>
      </div>
    </div>
  );
};
