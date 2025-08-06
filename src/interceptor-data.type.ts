export type InterceptorRequestData = { methodName: string; args: unknown[] };
export type InterceptorResponseData = {
  methodName: string;
  args: unknown[];
  response: unknown;
};
export type InterceptorErrorData = {
  methodName: string;
  args: unknown[];
  error: unknown;
};

/**
 * Interceptor options for customizing actor request/response handling
 */
export interface InterceptorOptions {
  /** Callback function that will be called before the request is sent. Should return the modified arguments array. */
  onRequest?: (data: InterceptorRequestData) => unknown[];

  /** Callback function that will be called after a successful response is received. Should return the modified response. */
  onResponse?: (data: InterceptorResponseData) => unknown;

  /** Callback function that will be called when a TypeError occurs during the request. Should return the modified error. */
  onRequestError?: (data: InterceptorErrorData) => Error | TypeError | unknown;

  /** Callback function that will be called when an error occurs during the response. Should return the modified error. */
  onResponseError?: (data: InterceptorErrorData) => Error | TypeError | unknown;
}
