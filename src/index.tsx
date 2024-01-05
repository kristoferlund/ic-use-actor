import {
  Actor,
  type ActorConfig,
  type ActorSubclass,
  HttpAgent,
  type HttpAgentOptions,
  SignIdentity,
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

/**
 *
 */
export type ActorContextType<T> = {
  actor?: ActorSubclass<T>;
};

export function createActorContext<T>() {
  return createContext<ActorContextType<T> | undefined>(undefined);
}

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
  identity?: SignIdentity;

  /** A factory function provided by the DFINITY Candid library to generate the interface for the actor. */
  idlFactory: IDL.InterfaceFactory;

  /** The unique identifier of the canister that the actor will interact with.*/
  canisterId: string;

  /** The React component(s) that will be wrapped by the ActorProvider. */
  children: ReactNode;

  /** Callback function that will be called before the request is sent. */
  onRequest?: (args: unknown) => void;

  /** Callback function that will be called before the response is returned. */
  onResponse?: (response: unknown) => void;

  /** Callback function that will be called if the request fails. */
  onRequestError?: (error: unknown) => void;

  /** Callback function that will be called if the response fails. */
  onResponseError?: (error: unknown) => void;
}) {
  const [actor, setActor] = useState<ActorSubclass<typeof context>>();

  useEffect(() => {
    function createErrorHandlingProxy<T>(
      actor: ActorSubclass<T>
    ): ActorSubclass<T> {
      return new Proxy(actor, {
        get(target, prop, receiver) {
          const originalProperty = Reflect.get(target, prop, receiver);
          if (typeof originalProperty === "function") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return async (...args: any[]) => {
              try {
                onRequest?.(args);
                const response = await originalProperty.apply(this, args);
                onResponse?.(response);
                return response;
              } catch (err) {
                if (err instanceof TypeError) {
                  onRequestError?.(err);
                } else {
                  onResponseError?.(err);
                }
                throw err; // Re-throw the error after handling
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

      setActor(createErrorHandlingProxy(_actor));
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
