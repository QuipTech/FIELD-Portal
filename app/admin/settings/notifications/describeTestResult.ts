import type { SendTestResult, TestDeliveryChannel } from "@/lib/types/notificationSettings";

const CHANNEL_LABELS: Record<TestDeliveryChannel, string> = {
  in_app: "in-app",
  push: "push",
  email: "email",
  sms: "SMS",
};

// "Test sent to you: in-app, email. SMS skipped: No phone number."
export const describeTestResult = (result: SendTestResult | null): { text: string; isError: boolean } => {
  if (!result?.isNotified) {
    return { text: "Couldn't send a test: your account isn't in this organisation.", isError: true };
  }
  const labelsWith = (status: string) =>
    result.deliveries.filter((delivery) => delivery.result.status === status);
  const sent = labelsWith("sent").map((delivery) => CHANNEL_LABELS[delivery.channel]);
  const problems = [...labelsWith("failed"), ...labelsWith("skipped")].map(
    (delivery) =>
      `${CHANNEL_LABELS[delivery.channel]} ${delivery.result.status}: ${delivery.result.error ?? "unknown reason"}`,
  );
  return {
    text: [`Test sent to you: ${sent.join(", ")}.`, ...problems.map((problem) => `${problem}.`)].join(" "),
    isError: labelsWith("failed").length > 0,
  };
};
