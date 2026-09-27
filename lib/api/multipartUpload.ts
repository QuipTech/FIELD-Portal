import { API_BASE_URL, ApiError, extractErrorMessage } from "./httpClient";

const NETWORK_ERROR_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

// POSTs a file (field "file") plus optional text fields to a FIELD API
// endpoint as multipart/form-data. XHR rather than fetch because fetch
// can't report upload progress. Errors surface as ApiError, like
// apiRequest, so toApiErrorMessage handles them.
export const uploadMultipart = <TResponse>(
  path: string,
  options: {
    accessToken: string;
    file: File;
    fields?: Record<string, string | undefined>;
    onProgress?: (fraction: number) => void;
  },
): Promise<TResponse> =>
  new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(options.fields ?? {}).forEach(([name, value]) => value !== undefined && form.append(name, value));
    form.append("file", options.file);

    const request = new XMLHttpRequest();
    request.open("POST", `${API_BASE_URL}${path}`);
    request.setRequestHeader("Authorization", `Bearer ${options.accessToken}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      const body = (() => {
        try {
          return JSON.parse(request.responseText) as unknown;
        } catch {
          return null;
        }
      })();
      if (request.status >= 200 && request.status < 300) resolve(body as TResponse);
      else reject(new ApiError(extractErrorMessage(body), request.status));
    };
    request.onerror = () => reject(new ApiError(NETWORK_ERROR_MESSAGE, 0));
    request.send(form);
  });
