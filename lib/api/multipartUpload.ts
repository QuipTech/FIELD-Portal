import { refreshAccessToken } from "../auth/refreshAccessToken";
import { API_BASE_URL, ApiError, CLIENT_HEADERS, extractErrorMessage } from "./httpClient";

const NETWORK_ERROR_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

interface MultipartUploadOptions {
  accessToken: string;
  file: File;
  fields?: Record<string, string | undefined>;
  onProgress?: (fraction: number) => void;
}

const parseResponseBody = (responseText: string): unknown => {
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return null;
  }
};

const sendMultipart = (path: string, options: MultipartUploadOptions): Promise<{ status: number; body: unknown }> =>
  new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(options.fields ?? {}).forEach(([name, value]) => value !== undefined && form.append(name, value));
    form.append("file", options.file);

    const request = new XMLHttpRequest();
    request.open("POST", `${API_BASE_URL}${path}`);
    request.setRequestHeader("Authorization", `Bearer ${options.accessToken}`);
    Object.entries(CLIENT_HEADERS).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    request.onload = () => resolve({ status: request.status, body: parseResponseBody(request.responseText) });
    request.onerror = () => reject(new ApiError(NETWORK_ERROR_MESSAGE, 0));
    request.send(form);
  });

// POSTs a file (field "file") plus optional text fields to a FIELD API
// endpoint as multipart/form-data. XHR rather than fetch because fetch
// can't report upload progress. An expired access token is refreshed and
// the upload sent once more, as apiRequest does. Errors surface as
// ApiError, so toApiErrorMessage handles them.
export const uploadMultipart = async <TResponse>(path: string, options: MultipartUploadOptions): Promise<TResponse> => {
  let response = await sendMultipart(path, options);
  if (response.status === 401) {
    const accessToken = await refreshAccessToken();
    if (accessToken) response = await sendMultipart(path, { ...options, accessToken });
  }
  if (response.status >= 200 && response.status < 300) return response.body as TResponse;
  throw new ApiError(extractErrorMessage(response.body), response.status);
};
