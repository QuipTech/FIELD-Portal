import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { SettingsRow } from "@/components/settings/settingsRow";
import { SubscriptionSummaryCard } from "@/components/settings/subscriptionSummaryCard";
import { ExportDataButton } from "@/components/settings/exportDataButton";
import { DeleteAccountButton } from "@/components/settings/deleteAccountButton";
import { ProfileHeaderCard } from "./components/profileHeaderCard";
import { SecuritySettingsSection } from "./components/securitySettingsSection";

const SettingsPage = () => {
  return (
    <AppShell
      topBar={
        <TopBar>
          <span className="text-[15px] text-bodyGray">Profile &amp; settings</span>
        </TopBar>
      }
    >
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        <h1 className="text-[22px] font-medium text-ink">Profile &amp; settings</h1>
        <ProfileHeaderCard />

        <h2 className="text-base font-medium text-ink">Subscription</h2>
        <SubscriptionSummaryCard showBillingLink />

        <SecuritySettingsSection />

        <h2 className="text-base font-medium text-ink">My data</h2>
        <div className="flex flex-col rounded-xl border border-borderGray bg-surface">
          <SettingsRow
            icon="download"
            title="Export my data"
            caption="Your profile, history entries, case activity and AI conversations, as a download link"
            trailing={<ExportDataButton />}
          />
          <SettingsRow
            icon="alert"
            tone="danger"
            title="Delete account"
            caption="Permanently removes your profile and personal data; asset and configuration records stay on the company's CMDB"
            bordered={false}
            trailing={<DeleteAccountButton />}
          />
        </div>
      </main>
    </AppShell>
  );
};

export default SettingsPage;
