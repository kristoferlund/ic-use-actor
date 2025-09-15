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
 *
 * All callbacks may return a value or a Promise — async handlers are supported.
 */
export interface InterceptorOptions {
  /** Callback called before the request is sent. May return modified arguments array (sync or Promise). */
  onRequest?: (data: InterceptorRequestData) => unknown[] | Promise<unknown[]>;

  /** Callback called after a successful response is received. May return modified response (sync or Promise). */
  onResponse?: (data: InterceptorResponseData) => unknown | Promise<unknown>;

  /** Callback called when an error occurs during request setup. May return a replacement error or throw. */
  onRequestError?: (data: InterceptorErrorData) => unknown | Promise<unknown>;

  /** Callback called when an error occurs during the response. May return a replacement error or throw. */
  onResponseError?: (data: InterceptorErrorData) => unknown | Promise<unknown>;
}
