"use client";

import { useRef, type ReactElement } from "react";

interface FilePicker {
  open: () => void;
  input: ReactElement;
}

const useHiddenFileInput = (accept: string, multiple: boolean, onPick: (files: File[]) => void): FilePicker => {
  const inputRef = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      className="hidden"
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (files.length > 0) onPick(files);
      }}
    />
  );
  return { open: () => inputRef.current?.click(), input };
};

// A hidden <input type="file"> plus a function to open it. Render `input`
// anywhere in the component; the same file can be picked twice in a row.
export const useFilePicker = (accept: string, onPick: (file: File) => void): FilePicker =>
  useHiddenFileInput(accept, false, ([file]) => onPick(file));

// As useFilePicker, choosing several files at once.
export const useMultiFilePicker = (accept: string, onPick: (files: File[]) => void): FilePicker =>
  useHiddenFileInput(accept, true, onPick);
