import {
  Actor,
  type ActorConfig,
  type ActorSubclass,
  HttpAgent,
  type HttpAgentOptions,
  type Identity,
} from "@dfinity/agent";
import {
  type ReactNode,
  useEffect,
  useState,
  createContext,
  type Context,
  useContext,
} from "react";
import { IDL } from "@dfinity/candid";
import type {
  InterceptorErrorData,
  InterceptorRequestData,
  InterceptorResponseData,
} from "./interceptor-data.type";

/**
 *
 */
export type ActorContextType<T> = {
  actor?: ActorSubclass<T>;
};

/**
 * Creates a React context that will be used to pass the actor down the component tree. Invoke the `createActorContext` function with the _SERVICE
 * type argument, where _SERVICE represents the canister service definition.
 *
 * @example
 * ```ts
 * const ActorContext = createActorContext<_SERVICE>();
 * ```
 */
export function createActorContext<T>() {
  return createContext<ActorContextType<T> | undefined>(undefined);
}

/**
 * Creates a React hook that can be used to access the actor from any component in the component tree. Invoke the `createUseActorHook` function with the
 * React context returned by the `createActorContext` function. The function needs to be invoked with the _SERVICE type argument, where _SERVICE
 * represents the canister service definition. Export the hook to be able to use it in other components.
 *
 * @example
 * ```ts
 * export const useActor = createUseActorHook<_SERVICE>(actorContext);
 * ```
 */
export function createUseActorHook<T>(
  context: Context<ActorContextType<T> | undefined>
) {
  return function useActor() {
    const actorContext = useContext(context);
    if (!actorContext) {
      throw new Error("useActor must be used within an ActorProvider");
    }
    return actorContext;
  };
}

/**
 * The ActorProvider component is used to provide the actor to the component tree. The component needs to be wrapped around the component tree that
 * needs to access the actor.
 *
 * @example
 * ```tsx
 * import { ReactNode } from "react";
 * import {
 *   ActorProvider,
 *   createActorContext,
 *   createUseActorHook,
 * } from "ic-use-actor";
 * import {
 *  canisterId,
 *   idlFactory,
 * } from "path-to/your-service/index";
 * import { _SERVICE } from "path-to/your-service.did";
 * import { useSiweIdentity } from "ic-use-siwe-identity";
 *
 * const actorContext = createActorContext<_SERVICE>();
 * export const useActor = createUseActorHook<_SERVICE>(actorContext);
 *
 * export default function Actors({ children }: { children: ReactNode }) {
 *   const { identity } = useSiweIdentity();
 *
 *   return (
 *     <ActorProvider<_SERVICE>
 *       canisterId={canisterId}
 *       context={actorContext}
 *       identity={identity}
 *       idlFactory={idlFactory}
 *     >
 *       {children}
 *     </ActorProvider>
 *   );
 * }
 * ```
 */
export function ActorProvider<T>({
  httpAgentOptions,
  actorOptions,
  context,
  identity,
  idlFactory,
  canisterId,
  children,
  onRequest,
  onResponse,
  onRequestError,
  onResponseError,
}: {
  /** Options for configuring the HTTP agent. This can include custom headers, credentials, and other settings related to network requests. */
  httpAgentOptions?: HttpAgentOptions;

  /** Configuration that can be passed to customize the Actor behaviour. */
  actorOptions?: ActorConfig;

  /** The React context to which the actor will be provided. This context will be used to pass the actor down the component tree. */
  context: React.Context<ActorContextType<T> | undefined>;

  /** The identity used for signing requests. */
  identity?: Identity;

  /** A factory function provided by the DFINITY Candid library to generate the interface for the actor. */
  idlFactory: IDL.InterfaceFactory;

  /** The unique identifier of the canister that the actor will interact with.*/
  canisterId: string;

  /** The React component(s) that will be wrapped by the ActorProvider. */
  children: ReactNode;

  /** Callback function that will be called before the request is sent. */
  onRequest?: (data: InterceptorRequestData) => unknown[];

  /** Callback function that will be called before the response is returned. */
  onResponse?: (data: InterceptorResponseData) => unknown;

  /** Callback function that will be called if the request fails. */
  onRequestError?: (data: InterceptorErrorData) => Error | TypeError | unknown;

  /** Callback function that will be called if the response fails. */
  onResponseError?: (data: InterceptorErrorData) => Error | TypeError | unknown;
}) {
  const [actor, setActor] = useState<ActorSubclass<typeof context>>();

  useEffect(() => {
    function createInterceptorProxy<T>(
      _actor: ActorSubclass<T>
    ): ActorSubclass<T> {
      return new Proxy(_actor, {
        get(target, prop, receiver) {
          const originalProperty = Reflect.get(target, prop, receiver);
          if (typeof originalProperty === "function") {
            return async (...args: unknown[]) => {
              try {
                if (onRequest) {
                  args = onRequest({ methodName: prop as string, args });
                }
                const response = await originalProperty.apply(this, args);
                if (onResponse) {
                  return onResponse({
                    methodName: prop as string,
                    args,
                    response,
                  });
                }
                return response;
              } catch (error) {
                if (error instanceof TypeError) {
                  if (onRequestError)
                    error = onRequestError({
                      methodName: prop as string,
                      args,
                      error,
                    });
                } else {
                  if (onResponseError)
                    error = onResponseError({
                      methodName: prop as string,
                      args,
                      error,
                    });
                }
                throw error;
              }
            };
          }
          return originalProperty;
        },
      });
    }

    (async () => {
      if (!identity || !idlFactory || !canisterId || !context) return;

      const agent = new HttpAgent({ identity, ...httpAgentOptions });

      if (process.env.DFX_NETWORK !== "ic") {
        agent.fetchRootKey().catch((err) => {
          console.warn(
            "Unable to fetch root key. Check to ensure that your local replica is running"
          );
          console.error(err);
        });
      }

      const _actor = Actor.createActor<typeof context>(idlFactory, {
        agent,
        canisterId,
        ...actorOptions,
      });

      setActor(createInterceptorProxy(_actor));
    })();
  }, [
    identity,
    httpAgentOptions,
    actorOptions,
    idlFactory,
    canisterId,
    context,
    onRequest,
    onResponse,
    onRequestError,
    onResponseError,
  ]);

  return (
    <context.Provider value={{ actor } as ActorContextType<T>}>
      {children}
    </context.Provider>
  );
}
