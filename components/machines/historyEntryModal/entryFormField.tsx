import type { ReactNode } from "react";

interface EntryFormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  isRequired?: boolean;
  className?: string;
  children: ReactNode;
}

export const EntryFormField = ({ label, htmlFor, error, isRequired = false, className = "", children }: EntryFormFieldProps) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-mutedGray">
      {label}
      {isRequired && <span aria-hidden className="text-danger"> *</span>}
    </label>
    {children}
    {error && (
      <span role="alert" className="text-xs text-danger">
        {error}
      </span>
    )}
  </div>
);
