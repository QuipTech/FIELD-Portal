// The Kinesis Video Streams WebRTC signaling protocol over the presigned
// wss:// URL: JSON frames whose payload is base64 of the JSON SDP or ICE
// candidate. The viewer sends SDP_OFFER and ICE_CANDIDATE; the master (the
// tablet) answers with SDP_ANSWER and its own ICE_CANDIDATEs.
export type SignalingAction = "SDP_OFFER" | "SDP_ANSWER" | "ICE_CANDIDATE";

export interface SignalingMessage {
  messageType: SignalingAction | "STATUS_RESPONSE" | "GO_AWAY" | "RECONNECT_ICE_SERVER";
  messagePayload?: string;
  senderClientId?: string;
  statusResponse?: { correlationId?: string; errorType?: string; statusCode?: string; description?: string };
}

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeSignalingAction = (action: SignalingAction, payload: unknown, recipientClientId?: string): string =>
  JSON.stringify({
    action,
    messagePayload: toBase64(JSON.stringify(payload)),
    ...(recipientClientId ? { recipientClientId } : {}),
  });

// Null for frames that aren't signaling messages.
export const decodeSignalingMessage = (data: string): { message: SignalingMessage; payload: unknown } | null => {
  if (!data) return null;
  try {
    const message = JSON.parse(data) as SignalingMessage;
    const payload = message.messagePayload ? JSON.parse(fromBase64(message.messagePayload)) : null;
    return { message, payload };
  } catch {
    return null;
  }
};
