"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { BrandingPayload, OrganisationBranding } from "@/lib/types/organisationBranding";
import type { BrandingActions } from "../useBranding";
import { findBrandingProblem, toBrandingForm, toBrandingPayload } from "../brandingForm";
import { ColorField } from "./colorField";
import { LogoPicker } from "./logoPicker";
import { BrandingPreview } from "./brandingPreview";

interface BrandingEditorProps extends BrandingActions {
  branding: OrganisationBranding;
}

const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";

export const BrandingEditor = ({ branding, saveBranding, uploadLogo, removeLogo }: BrandingEditorProps) => {
  const [form, setForm] = useState<BrandingPayload>(() => toBrandingForm(branding));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const problem = findBrandingProblem(form);
  const update = <K extends keyof BrandingPayload>(key: K, value: BrandingPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem) return;
    setIsSaving(true);
    try {
      await saveBranding(toBrandingPayload(form));
      setNotice({ tone: "ok", text: "Branding saved." });
    } catch (error) {
      setNotice({ tone: "error", text: toApiErrorMessage(error, "Couldn't save branding. Please try again.") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="flex h-full flex-col gap-3.5 rounded-2xl border border-slate-200/80 bg-surface p-6"
      >
        <h2 className="text-base font-medium text-ink">Company branding</h2>
        <LogoPicker branding={branding} onUpload={uploadLogo} onRemove={removeLogo} />
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Company name</span>
          <Input
            value={form.companyName}
            onChange={(event) => update("companyName", event.target.value)}
            maxLength={200}
          />
        </label>
        <div className="flex gap-3.5">
          <ColorField
            label="Primary color"
            value={form.primaryColor ?? ""}
            onChange={(value) => update("primaryColor", value)}
          />
          <ColorField
            label="Accent color"
            value={form.accentColor ?? ""}
            onChange={(value) => update("accentColor", value)}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Support email footer</span>
          <Input
            placeholder="support@yourcompany.com — shown on emails & case receipts"
            value={form.supportFooter ?? ""}
            onChange={(event) => update("supportFooter", event.target.value)}
            maxLength={300}
          />
        </label>
        <div className="flex items-center">
          <span className="text-[15px] text-ink">Show QuipTech FIELD watermark</span>
          <span className="ml-auto">
            <Switch on={form.showWatermark} onToggle={() => update("showWatermark", !form.showWatermark)} />
          </span>
        </div>
        {(problem || notice) && (
          <span className={`text-xs ${notice?.tone === "ok" && !problem ? "text-mutedGray" : "text-danger"}`}>
            {problem ?? notice?.text}
          </span>
        )}
        <Button type="submit" variant="primary" className="mt-auto h-11" disabled={Boolean(problem) || isSaving}>
          {isSaving ? "Saving…" : "Save branding"}
        </Button>
      </form>
      <BrandingPreview form={form} logoUrl={branding.logoUrl} />
    </div>
  );
};
