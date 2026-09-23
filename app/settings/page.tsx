import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { Tag } from "@/components/ui/tag";
import { LinkButton } from "@/components/ui/linkButton";
import { SettingsRow } from "@/components/settings/settingsRow";
import { SubscriptionSummaryCard } from "@/components/settings/subscriptionSummaryCard";
import { ExportDataButton } from "@/components/settings/exportDataButton";
import { DeleteAccountButton } from "@/components/settings/deleteAccountButton";
import { ManageTwoFactorButton } from "@/components/settings/manageTwoFactorButton";
import { ProfileHeaderCard } from "./components/profileHeaderCard";

const SettingsPage = () => {
  return (
    <AppShell topBar={<TopBar><span className="text-[15px] text-bodyGray">Profile &amp; settings</span></TopBar>}>
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        <h1 className="text-[22px] font-medium text-ink">Profile &amp; settings</h1>
        <ProfileHeaderCard />

        <h2 className="text-base font-medium text-ink">Subscription</h2>
        <SubscriptionSummaryCard captionLine="QuipTech Mining · billed per asset, monthly" showBillingLink />

        <h2 className="text-base font-medium text-ink">Security</h2>
        <div className="flex flex-col rounded-xl border border-borderGray bg-white">
          <SettingsRow
            icon="lock"
            title="Password"
            caption="Last changed 3 months ago"
            trailing={
              <LinkButton href="/forgot-password" size="sm">
                Change
              </LinkButton>
            }
          />
          <SettingsRow
            icon="shield"
            tone="primary"
            title="Two-factor authentication"
            caption="SMS to •••• •••• 214"
            bordered={false}
            trailing={
              <>
                <Tag tone="ok">On</Tag>
                <ManageTwoFactorButton />
              </>
            }
          />
        </div>

        <h2 className="text-base font-medium text-ink">My data</h2>
        <div className="flex flex-col rounded-xl border border-borderGray bg-white">
          <SettingsRow
            icon="download"
            title="Export my data"
            caption="Download your profile, history entries and case activity"
            trailing={<ExportDataButton />}
          />
          <SettingsRow
            icon="alert"
            tone="danger"
            title="Delete my account"
            caption="Removes your profile; asset and configuration records stay on the tenant's CMDB"
            bordered={false}
            trailing={<DeleteAccountButton />}
          />
        </div>
      </main>
    </AppShell>
  );
};

export default SettingsPage;
