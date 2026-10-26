import { PasskeySettingsSection } from "@/components/settings/passkeySettingsSection";
import { BiometricPhonesSection } from "@/components/settings/biometricPhonesSection";

// The signed-in admin's own sign-in options: Face ID / Touch ID devices
// (passkeys) and phones with mobile app fingerprint / Face ID sign-in.
const SecuritySettingsPage = () => (
  <section className="flex max-w-3xl flex-col gap-3">
    <PasskeySettingsSection />
    <BiometricPhonesSection />
  </section>
);

export default SecuritySettingsPage;
