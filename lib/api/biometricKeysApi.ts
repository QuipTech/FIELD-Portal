import { apiRequest } from "./httpClient";

// A phone with fingerprint / Face ID sign-in on in the FIELD mobile app.
// The app turns it on; the portal can only list and remove.
export interface BiometricPhone {
  id: string;
  deviceType: "ios" | "android";
  appVersion: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const authorised = (token: string) => ({ Authorization: `Bearer ${token}` });

export const listBiometricPhonesRequest = (token: string) =>
  apiRequest<BiometricPhone[]>("/me/biometric-keys", { headers: authorised(token) });

export const deleteBiometricPhoneRequest = (token: string, id: string) =>
  apiRequest(`/me/biometric-keys/${id}`, { method: "DELETE", headers: authorised(token) });
