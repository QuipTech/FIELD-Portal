import Link from "next/link";
import { AuthFlowLayout } from "@/components/auth/authFlowLayout";
import { Button } from "@/components/ui/button";

const digitCount = 6;

const VerifyCodePage = () => {
  return (
    <AuthFlowLayout
      icon="shield"
      title="Enter the code"
      subtitle="We sent a 6-digit code to j.okoye@quiptech.com"
      step={2}
      stepCount={3}
    >
      <div className="flex justify-center gap-2">
        {Array.from({ length: digitCount }).map((_, index) => (
          <input
            key={index}
            maxLength={1}
            inputMode="numeric"
            className="h-[52px] w-[42px] rounded-lg border border-borderGrayStrong text-center text-xl font-medium text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primaryTint"
          />
        ))}
      </div>
      <span className="text-xs text-mutedGray">
        Didn&apos;t get it?{" "}
        <Link href="/forgot-password" className="text-primary">
          Resend code
        </Link>
      </span>
      <Button variant="primary" className="h-11 w-full">
        Verify code
      </Button>
    </AuthFlowLayout>
  );
};

export default VerifyCodePage;
