// The control messages the viewer sends to the tablet over the "control"
// WebRTC data channel (protocol v1). Coordinates are fractions (0 to 1) of
// the streamed screen, so the tablet maps them to its own resolution.
export type ControlMessage =
  | { v: 1; type: "pointer"; action: "down" | "move" | "up" | "cancel"; x: number; y: number; button: number }
  | { v: 1; type: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
  | {
      v: 1;
      type: "key";
      action: "down" | "up";
      key: string;
      code: string;
      alt: boolean;
      ctrl: boolean;
      shift: boolean;
      meta: boolean;
    }
  | { v: 1; type: "text"; text: string };

export interface ElementBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const round = (value: number) => Math.round(value * 10000) / 10000;

// Where a point on a <video> with object-fit: contain lands on the streamed
// screen; null in the letterbox bars or before the video has a size.
export const toScreenPoint = (
  clientX: number,
  clientY: number,
  box: ElementBox,
  videoWidth: number,
  videoHeight: number,
): { x: number; y: number } | null => {
  if (!videoWidth || !videoHeight || !box.width || !box.height) return null;
  const scale = Math.min(box.width / videoWidth, box.height / videoHeight);
  const shownWidth = videoWidth * scale;
  const shownHeight = videoHeight * scale;
  const offsetX = (box.width - shownWidth) / 2;
  const offsetY = (box.height - shownHeight) / 2;
  const x = (clientX - box.left - offsetX) / shownWidth;
  const y = (clientY - box.top - offsetY) / shownHeight;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: round(x), y: round(y) };
};

// Browser shortcuts the viewer keeps for itself (closing or reloading the
// window); everything else goes to the tablet.
const VIEWER_SHORTCUTS = new Set(["F5"]);

export const shouldSendKey = (event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">) => {
  if (VIEWER_SHORTCUTS.has(event.key)) return false;
  if ((event.ctrlKey || event.metaKey) && ["w", "r", "t", "n"].includes(event.key.toLowerCase())) return false;
  return true;
};

export const toKeyMessage = (
  action: "down" | "up",
  event: Pick<KeyboardEvent, "key" | "code" | "altKey" | "ctrlKey" | "shiftKey" | "metaKey">,
): ControlMessage => ({
  v: 1,
  type: "key",
  action,
  key: event.key,
  code: event.code,
  alt: event.altKey,
  ctrl: event.ctrlKey,
  shift: event.shiftKey,
  meta: event.metaKey,
});
