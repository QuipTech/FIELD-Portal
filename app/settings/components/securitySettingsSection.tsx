"use client";

import { Tag } from "@/components/ui/tag";
import { SettingsRow } from "@/components/settings/settingsRow";
import { ManageTwoFactorButton } from "@/components/settings/manageTwoFactorButton";
import { ChangePasswordButton } from "@/components/settings/changePasswordButton";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";

// Google/Apple users have no FIELD password, and their second factor is
// managed by Google/Apple, so neither setting applies to them. Hidden until
// the profile has loaded so it never flashes up for them.
export const SecuritySettingsSection = () => {
  const signedInProfile = useSignedInProfile();
  if (!signedInProfile || signedInProfile.signInMethod === "federated") return null;

  return (
    <>
      <h2 className="text-base font-medium text-ink">Security</h2>
      <div className="flex flex-col rounded-xl border border-borderGray bg-surface">
        <SettingsRow
          icon="lock"
          title="Password"
          caption="Last changed 3 months ago"
          trailing={<ChangePasswordButton email={signedInProfile.user.email} />}
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
    </>
  );
};
