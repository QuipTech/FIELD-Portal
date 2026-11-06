"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { renderDocx } from "./renderDocx";

interface PreviewProps {
  url: string;
  fileName: string;
  onFailed: () => void;
}

const fetchFile = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't fetch the file (${response.status}).`);
  return response.blob();
};

const Loading = () => (
  <div className="absolute inset-0 flex items-center justify-center text-mutedGray">
    <LoadingSpinner size="md" />
  </div>
);

// Word: the uploaded file is drawn in a frame with scripts turned off, so
// nothing inside it can reach the portal. allow-same-origin only lets the
// portal draw into the frame.
export const DocxPreview = ({ url, fileName, onFailed }: PreviewProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    const draw = async () => {
      const file = await fetchFile(url);
      const frameDocument = frameRef.current?.contentDocument;
      if (!isCurrent || !frameDocument) return;
      await renderDocx(file, frameDocument.body, frameDocument.head);
      if (isCurrent) setIsLoading(false);
    };
    draw().catch(() => isCurrent && onFailed());
    return () => {
      isCurrent = false;
    };
  }, [url, onFailed]);

  return (
    <>
      {isLoading && <Loading />}
      <iframe ref={frameRef} title={fileName} sandbox="allow-same-origin" className="h-full w-full bg-white" />
    </>
  );
};

// HEIC: only Safari can draw it, so it's converted to a JPEG in the browser.
export const HeicPreview = ({ url, fileName, onFailed }: PreviewProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    let createdUrl: string | null = null;
    const convert = async () => {
      const [file, { heicTo }] = await Promise.all([fetchFile(url), import("heic-to/next")]);
      const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
      if (!isCurrent) return;
      createdUrl = URL.createObjectURL(jpeg);
      setImageUrl(createdUrl);
    };
    convert().catch(() => isCurrent && onFailed());
    return () => {
      isCurrent = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url, onFailed]);

  if (!imageUrl) return <Loading />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageUrl} alt={fileName} className="h-full w-full object-contain" />;
};
