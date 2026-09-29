import type { BrandingPayload } from "@/lib/types/organisationBranding";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR, isHexColor } from "../brandingForm";

interface BrandingPreviewProps {
  form: BrandingPayload;
  logoUrl: string | null;
}

// Follows the form as it's edited, before anything is saved.
export const BrandingPreview = ({ form, logoUrl }: BrandingPreviewProps) => {
  const primary = isHexColor(form.primaryColor ?? "") ? form.primaryColor! : DEFAULT_PRIMARY_COLOR;
  const accent = isHexColor(form.accentColor ?? "") ? form.accentColor! : DEFAULT_ACCENT_COLOR;
  const companyName = form.companyName.trim() || "Your company";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
      <div className="border-b border-slate-200/80 bg-surface p-6">
        <h3 className="text-base font-semibold text-slate-900">Live preview</h3>
        <p className="mt-0.5 text-xs text-slate-400">How your brand shows across the app</p>
      </div>
      <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center bg-slate-50/80 p-8">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL
          <img src={logoUrl} alt="" className="h-12 w-12 rounded-xl object-contain" />
        ) : (
          <div
            style={{ backgroundColor: primary }}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm"
          >
            {companyName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="mt-3 text-sm font-semibold text-slate-900">{companyName}</div>
        <div
          style={{ backgroundColor: primary }}
          className="mt-3.5 w-48 rounded-xl py-2 text-center text-xs font-medium text-white shadow-sm"
        >
          Sign in
        </div>
        {form.supportFooter?.trim() && (
          <div
            style={{ borderColor: accent, color: accent }}
            className="mt-5 max-w-full truncate rounded-lg border bg-white px-3 py-1 text-[11px]"
          >
            Case receipt footer · {form.supportFooter.trim()}
          </div>
        )}
        {form.showWatermark && <div className="mt-4 text-[10px] text-slate-400">Powered by QuipTech FIELD</div>}
      </div>
    </div>
  );
};
