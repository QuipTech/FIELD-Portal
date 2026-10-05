import type { ReactNode } from "react";
import { Icon } from "@/components/icons/icon";
import { formatShortDateTime } from "@/lib/format/shortDate";
import type { DemoRequest } from "@/lib/types/demoRequest";

const sectionTitleClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";

const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex gap-3 py-1.5 text-sm">
    <span className="w-24 flex-none text-mutedGray">{label}</span>
    <span className="min-w-0 flex-1 break-words text-ink">{children}</span>
  </div>
);

const EmailState = ({ label, sentAt }: { label: string; sentAt: string | null }) => (
  <div className="flex items-center gap-2 py-1 text-sm">
    <Icon name={sentAt ? "check" : "alert"} className={`h-4 w-4 ${sentAt ? "stroke-primary" : "stroke-amber"}`} />
    <span className="text-ink">{label}</span>
    <span className={`ml-auto text-xs ${sentAt ? "text-mutedGray" : "text-amber"}`}>
      {sentAt ? `Sent ${formatShortDateTime(sentAt)}` : "Not sent"}
    </span>
  </div>
);

// Everything the requester typed, plus when it arrived and which emails
// went out.
export const DemoRequestDetails = ({ request }: { request: DemoRequest }) => (
  <>
    <section className="flex flex-col">
      <span className={sectionTitleClasses}>Request</span>
      <DetailRow label="Email">
        <a href={`mailto:${request.email}`} className="text-primary hover:underline">
          {request.email}
        </a>
      </DetailRow>
      <DetailRow label="Phone">{request.phone ?? "—"}</DetailRow>
      <DetailRow label="Company">{request.company}</DetailRow>
      <DetailRow label="Country">{request.country}</DetailRow>
      <DetailRow label="Received">{formatShortDateTime(request.createdAt)}</DetailRow>
      <DetailRow label="IP address">{request.ipAddress ?? "—"}</DetailRow>
      <DetailRow label="Message">
        {request.message ? <span className="whitespace-pre-line">{request.message}</span> : "—"}
      </DetailRow>
    </section>
    <section className="flex flex-col">
      <span className={sectionTitleClasses}>Emails</span>
      <EmailState label="Team notification" sentAt={request.teamEmailSentAt} />
      <EmailState label="Confirmation to requester" sentAt={request.userEmailSentAt} />
    </section>
  </>
);
