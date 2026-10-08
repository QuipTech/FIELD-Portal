import { describeCaseEvent } from "@/lib/format/caseEventText";
import type { CaseEvent } from "@/lib/types/caseMessage";

const timeFormat = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });

// A centred system line: "A. Kaur assigned the case to T. Meyer · 08:31".
export const CaseEventLine = ({ event }: { event: CaseEvent }) => (
  <div className="flex justify-center" role="note">
    <span className="rounded-full bg-fillGray px-3.5 py-1.5 text-center text-sm text-mutedGray">
      {describeCaseEvent(event)} · {timeFormat.format(new Date(event.createdAt))}
    </span>
  </div>
);
