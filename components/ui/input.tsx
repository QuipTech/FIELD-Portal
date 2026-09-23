"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon, type IconName } from "../icons/icon";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: IconName;
}

export const Input = ({ icon, className = "", type, ...props }: InputProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordField = type === "password";

  return (
    <div
      className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border border-borderGrayStrong bg-white px-3 ${className}`}
    >
      {icon ? <Icon name={icon} className="stroke-mutedGray" /> : null}
      <input
        type={isPasswordField && isPasswordVisible ? "text" : type}
        className="w-full flex-1 border-none bg-transparent text-[15px] text-ink outline-none placeholder:text-mutedGray"
        {...props}
      />
      {isPasswordField && (
        <button
          type="button"
          aria-label={isPasswordVisible ? "Hide password" : "Show password"}
          onClick={() => setIsPasswordVisible((visible) => !visible)}
          className="flex-none text-mutedGray"
        >
          <Icon name={isPasswordVisible ? "eyeoff" : "eye"} className="stroke-mutedGray" />
        </button>
      )}
    </div>
  );
};
