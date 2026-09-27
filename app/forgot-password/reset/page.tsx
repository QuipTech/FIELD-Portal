import { AuthFlowLayout } from "@/components/auth/authFlowLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const NewPasswordPage = () => {
  return (
    <AuthFlowLayout
      icon="check"
      title="Set a new password"
      subtitle="Must be at least 8 characters, with a number and a symbol"
      step={3}
      stepCount={3}
    >
      <div className="flex w-full flex-col gap-1.5 text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">New password</span>
        <Input icon="lock" type="password" placeholder="••••••••" />
      </div>
      <div className="flex w-full flex-col gap-1.5 text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Confirm password</span>
        <Input icon="lock" type="password" placeholder="••••••••" />
      </div>
      <Button variant="primary" className="h-11 w-full">
        Update password
      </Button>
    </AuthFlowLayout>
  );
};

export default NewPasswordPage;
