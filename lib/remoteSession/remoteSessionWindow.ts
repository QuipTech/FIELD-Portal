// The remote session's own small window.
const WINDOW_FEATURES = "popup=yes,width=1100,height=720,resizable=yes,scrollbars=no";

// withPassword: the tablet has a FIELD ID, so the window asks for its password.
export const remoteSessionWindowUrl = (machineId: string, machineLabel: string, withPassword = false) =>
  `/remote-session/${encodeURIComponent(machineId)}?label=${encodeURIComponent(machineLabel)}${withPassword ? "&password=1" : ""}`;

export const CONNECT_BY_ID_URL = "/remote-session/connect";

// False when the browser blocked the pop-up. One window per name.
export const openRemoteSessionWindow = (url: string, name: string): boolean => {
  const opened = window.open(url, name, WINDOW_FEATURES);
  opened?.focus();
  return Boolean(opened);
};
