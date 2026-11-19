import type { McDeviceList } from "../types/machineControl";
import { apiRequest } from "./httpClient";

// Connected tablets on machines the person can see, online ones first.
export const listMcDevicesRequest = (accessToken: string): Promise<McDeviceList> =>
  apiRequest<McDeviceList>("/mc/devices", { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` } });
