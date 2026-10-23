import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

// A small uppercase label above one form control, as used in modal forms.
export const FormField = ({ label, children, className = "" }: FormFieldProps) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">{label}</span>
    {children}
  </label>
);
