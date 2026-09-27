import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const BrandingTab = () => {
  return (
    <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
      <div className="flex h-full flex-col gap-3.5 rounded-2xl border border-slate-200/80 bg-surface p-6">
        <h2 className="text-base font-medium text-ink">Company branding</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-[76px] w-[76px] flex-none items-center justify-center rounded-xl border border-borderGrayStrong bg-fillGray text-xs text-mutedGray">
            Logo
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm">
              <Icon name="upload" className="h-3.5 w-3.5" />
              Upload logo
            </Button>
            <span className="text-xs text-mutedGray">
              PNG or SVG, square, min 256px
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
            Company name
          </span>
          <Input defaultValue="QuipTech Mining" />
        </div>
        <div className="flex gap-3.5">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
              Primary color
            </span>
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 flex-none rounded-md border border-borderGrayStrong bg-primary" />
              <Input defaultValue="#4A34C7" className="font-mono" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
              Accent color
            </span>
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 flex-none rounded-md border border-borderGrayStrong bg-[#2CB8A6]" />
              <Input defaultValue="#2CB8A6" className="font-mono" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
            Support email footer
          </span>
          <Input defaultValue="support@quiptech.com — shown on emails & case receipts" />
        </div>
        <div className="flex items-center">
          <span className="text-[15px] text-ink">
            Show QuipTech FIELD watermark
          </span>
          <span className="ml-auto">
            <Switch on={false} />
          </span>
        </div>
        <Button variant="primary" className="mt-auto h-11">
          Save branding
        </Button>
      </div>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
        <div className="border-b h-80 border-slate-200/80 bg-surface p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Live preview
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            How your brand shows across the app
          </p>
        </div>
        <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center bg-slate-50/80 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4F39F6] text-lg font-bold text-white shadow-sm">
            Q
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-900">
            QuipTech Mining
          </div>
          <button className="mt-3.5 w-48 cursor-default rounded-xl bg-[#4F39F6] py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#4330db]">
            Sign in
          </button>
          <div className="mt-5 rounded-lg border border-indigo-100/80 bg-indigo-50/80 px-3 py-1 text-[11px] font-normal text-indigo-700">
            Case receipt footer · support@quiptech.com
          </div>
        </div>
      </div>
    </div>
  );
};
