import Link from "next/link";
import { AuthFlowLayout } from "@/components/auth/authFlowLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ForgotPasswordPage = () => {
  return (
    <AuthFlowLayout
      icon="lock"
      title="Reset your password"
      subtitle="Enter your work email and we'll send you a 6-digit code"
      step={1}
      stepCount={3}
    >
      <div className="flex w-full flex-col gap-1.5 text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Work email</span>
        <Input icon="user" type="email" placeholder="j.okoye@quiptech.com" />
      </div>
      <Button variant="primary" className="h-11 w-full">
        Send reset code
      </Button>
      <Link href="/login" className="text-xs text-primary">
        Back to sign in
      </Link>
    </AuthFlowLayout>
  );
};

export default ForgotPasswordPage;
