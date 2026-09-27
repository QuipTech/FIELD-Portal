import { Icon } from "@/components/icons/icon";
import { ComingSoonButton } from "@/components/ui/comingSoonButton";
import { OrDivider } from "@/components/auth/orDivider";

export const AppDownloadLinks = () => (
  <>
    <OrDivider label="or get the app" />
    <div className="flex gap-2">
      <ComingSoonButton
        label="Download on the App Store"
        className="flex items-center gap-2.5 rounded-lg bg-inkStatic px-3.5 py-2 text-white"
      >
        <Icon name="apple" className="stroke-white fill-white" />
        <div className="flex flex-col gap-0 text-left">
          <span className="text-[9px] leading-tight opacity-75">Download on the</span>
          <span className="text-[15px] font-medium leading-tight">App Store</span>
        </div>
      </ComingSoonButton>
      <ComingSoonButton
        label="Get it on Google Play"
        className="flex items-center gap-2.5 rounded-lg bg-inkStatic px-3.5 py-2 text-white"
      >
        <Icon name="play" className="fill-white stroke-none" />
        <div className="flex flex-col gap-0 text-left">
          <span className="text-[9px] leading-tight opacity-75">GET IT ON</span>
          <span className="text-[15px] font-medium leading-tight">Google Play</span>
        </div>
      </ComingSoonButton>
    </div>
  </>
);
