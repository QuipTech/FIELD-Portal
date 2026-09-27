import { getAccessToken } from "../auth/authSession";
import { ApiError } from "./httpClient";

// The stored access token, for calling an authenticated endpoint. No
// token is reported like an expired one (a 401), so callers handle both
// the same way (see toApiErrorMessage).
export const requireAccessToken = (): string => {
  const accessToken = getAccessToken();
  if (!accessToken) throw new ApiError("Unauthorized", 401);
  return accessToken;
};
