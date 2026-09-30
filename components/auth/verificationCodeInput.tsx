"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

interface VerificationCodeInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  // Called once every box is filled, e.g. to submit straight away.
  onComplete?: (code: string) => void;
  hasError?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * One box per digit. Typing moves to the next box, backspace to the
 * previous one, and pasting (or the phone's one-time-code autofill)
 * fills every box at once.
 */
export const VerificationCodeInput = ({
  length = 6,
  value,
  onChange,
  onComplete,
  hasError = false,
  disabled = false,
  autoFocus = false,
}: VerificationCodeInputProps) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // The code as of the latest keystroke. `value` only catches up on the
  // next render, but focus moves to the next box straight away — reading
  // the stale prop there sent the cursor back to the first box.
  const latestCode = useRef(value);
  latestCode.current = value;
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  const focusBox = (index: number) => inputRefs.current[Math.max(0, Math.min(index, length - 1))]?.focus();

  const commit = (nextCode: string) => {
    latestCode.current = nextCode;
    onChange(nextCode);
    if (nextCode.length === length) onComplete?.(nextCode);
  };

  // Writes `incoming` digits starting at box `index`; handles a single
  // keystroke and a multi-digit paste/autofill the same way.
  const fillFrom = (index: number, incoming: string) => {
    const incomingDigits = incoming.replace(/\D/g, "");
    if (!incomingDigits) return;
    const nextDigits = [...digits];
    incomingDigits
      .slice(0, length - index)
      .split("")
      .forEach((digit, offset) => {
        nextDigits[index + offset] = digit;
      });
    commit(nextDigits.join("").slice(0, length));
    focusBox(index + incomingDigits.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const clearIndex = digits[index] ? index : index - 1;
      if (clearIndex < 0) return;
      // The code has no gaps, so removing a digit drops everything after it.
      commit(value.slice(0, clearIndex));
      focusBox(clearIndex);
    } else if (event.key === "ArrowLeft") {
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    fillFrom(index, event.clipboardData.getData("text"));
  };

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          value={digit}
          // Boxes fill left to right: only the next empty one is editable.
          onFocus={(event) => {
            const nextEmptyIndex = latestCode.current.length;
            if (index > nextEmptyIndex) {
              focusBox(nextEmptyIndex);
              return;
            }
            // Selected, so typing over a filled box replaces its digit.
            event.target.select();
          }}
          onChange={(event) => {
            // With the old digit selected the new one replaces it; if not,
            // drop the old digit to find what was typed.
            const typed = digit ? event.target.value.replace(digit, "") : event.target.value;
            fillFrom(index, typed || event.target.value);
          }}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          className={`h-[52px] w-[42px] rounded-lg border bg-surface text-center text-xl font-medium text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primaryTint disabled:opacity-60 ${
            hasError ? "border-danger" : "border-borderGrayStrong"
          }`}
        />
      ))}
    </div>
  );
};
