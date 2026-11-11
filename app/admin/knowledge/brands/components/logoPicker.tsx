"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format/fileSize";

// Matches the API's LOGO_RULE (backend/src/storage/storageFileRules.ts).
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

interface LogoPickerProps {
  file: File | null;
  currentUrl?: string | null;
  currentAlt: string;
  onChange: (file: File | null) => void;
}

// Picks a logo, checks it straight away and shows a thumbnail with its size.
export const LogoPicker = ({ file, currentUrl, currentAlt, onChange }: LogoPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const pick = (picked: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!picked) return;
    if (!LOGO_TYPES.includes(picked.type)) {
      setError(`${picked.name} isn't a PNG, JPG or SVG image.`);
      return;
    }
    if (picked.size > MAX_LOGO_BYTES) {
      setError(`${picked.name} is ${formatFileSize(picked.size)}. Logos can be up to 2 MB.`);
      return;
    }
    setError(null);
    onChange(picked);
  };

  const shownUrl = previewUrl ?? currentUrl ?? null;
  return (
    <div className="flex flex-col gap-2 text-xs text-bodyGray">
      <span>Logo (PNG, JPG or SVG, up to 2 MB)</span>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-borderGray bg-white/5">
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={shownUrl} alt={file ? `Preview of ${file.name}` : currentAlt} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-mutedGray">No logo</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          {file ? (
            <>
              <span className="truncate text-ink" title={file.name}>
                {file.name}
              </span>
              <span className="text-mutedGray">{formatFileSize(file.size)}</span>
            </>
          ) : (
            <span className="text-mutedGray">{currentUrl ? "Current logo" : "No file chosen"}</span>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
              {file || currentUrl ? "Change" : "Choose file"}
            </Button>
            {file && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_TYPES.join(",")}
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
