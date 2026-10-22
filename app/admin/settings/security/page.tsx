import { PasskeySettingsSection } from "@/components/settings/passkeySettingsSection";

// The signed-in admin's own sign-in options (Face ID / Touch ID devices).
const SecuritySettingsPage = () => (
  <section className="flex max-w-3xl flex-col gap-3">
    <PasskeySettingsSection />
  </section>
);

export default SecuritySettingsPage;
