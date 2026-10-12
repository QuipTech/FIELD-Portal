"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

interface ClickableRowProps {
  label: string;
  onOpen: () => void;
  children: ReactNode;
  className?: string;
}

// A whole row or card that opens something, by click or Enter, while the
// buttons and links inside it (e.g. Download) keep their own action. Not a
// <button>/<a> itself, so those can be nested inside.
export const ClickableRow = ({ label, onOpen, children, className = "" }: ClickableRowProps) => {
  const isFromNestedControl = (target: EventTarget) =>
    target instanceof Element && target.closest("a, button, input, select, textarea, [data-row-ignore]") !== null;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isFromNestedControl(event.target)) return;
    onOpen();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.target !== event.currentTarget) return;
    event.preventDefault();
    onOpen();
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={label}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primaryBorder ${className}`}
    >
      {children}
    </div>
  );
};
