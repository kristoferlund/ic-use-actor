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
