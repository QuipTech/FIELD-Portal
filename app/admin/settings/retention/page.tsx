import { redirect } from "next/navigation";

// The tab moved to /admin/settings/data-retention; keeps old links working.
const RetentionSettingsRedirect = () => redirect("/admin/settings/data-retention");

export default RetentionSettingsRedirect;
