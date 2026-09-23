import { Icon } from "@/components/icons/icon";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";

export const PromptCard = () => {
  return (
    <Card className="gap-3">
      <div className="flex items-center">
        <h2 className="text-base font-medium text-ink">Prompt</h2>
        <Tag tone="primary" className="ml-auto">v3 · live</Tag>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Prompt version</span>
        <div className="flex h-10 items-center gap-2 rounded-lg border border-borderGrayStrong px-3">
          <span className="text-[15px] text-ink">v3 — published 17 Mar by A. Kaur</span>
          <Icon name="chevd" className="ml-auto stroke-mutedGray" />
        </div>
      </div>
      <div className="flex gap-2.5">
        <Button><Icon name="diff" />View diff vs v2</Button>
        <Button><Icon name="history" />Version history</Button>
      </div>
      <div className="mt-auto flex gap-2.5">
        <Button><Icon name="eye" />Test</Button>
        <Button variant="primary" className="ml-auto"><Icon name="check" />Save prompt</Button>
      </div>
    </Card>
  );
};
