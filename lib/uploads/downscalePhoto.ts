import type { AttachedPhoto } from "../types/aiAssistant";

// Claude sees nothing past ~1568px on the long edge, so larger photos
// only cost upload time and tokens.
const MAX_EDGE_PX = 1568;
const JPEG_QUALITY = 0.85;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image we can read."));
    };
    image.src = url;
  });

// Any browser-readable image → a JPEG no larger than MAX_EDGE_PX, as
// base64 for POST /ai/ask plus a data URL for the preview.
export const downscalePhoto = async (file: File): Promise<AttachedPhoto> => {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't prepare the photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const previewUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { mediaType: "image/jpeg", data: previewUrl.split(",")[1], previewUrl };
};
