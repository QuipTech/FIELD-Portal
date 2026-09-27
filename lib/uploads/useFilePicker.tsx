"use client";

import { useRef, type ReactElement } from "react";

// A hidden <input type="file"> plus a function to open it. Render `input`
// anywhere in the component; the same file can be picked twice in a row.
export const useFilePicker = (accept: string, onPick: (file: File) => void): { open: () => void; input: ReactElement } => {
  const inputRef = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) onPick(file);
      }}
    />
  );
  return { open: () => inputRef.current?.click(), input };
};
