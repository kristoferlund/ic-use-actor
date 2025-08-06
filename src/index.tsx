import { createStore } from "@xstate/store";
import {
  Actor,
  type ActorConfig,
  type ActorSubclass,
  HttpAgent,
  type HttpAgentOptions,
  type Identity,
} from "@dfinity/agent";
import { IDL } from "@dfinity/candid";
import { useSelector } from "@xstate/store/react";
import type { InterceptorOptions } from "./interceptor-data.type";

/**
 * Re-export types
 */
export * from "./interceptor-data.type";

/**
 * Configuration options for creating an actor store
 */
export interface CreateActorStoreOptions {
  /** The unique identifier of the canister that the actor will interact with. */
  canisterId: string;

  /** A factory function provided by the DFINITY Candid library to generate the interface for the actor. */
  idlFactory: IDL.InterfaceFactory;

  /** Options for configuring the HTTP agent. */
  httpAgentOptions?: HttpAgentOptions;

  /** Configuration that can be passed to customize the Actor behaviour. */
  actorOptions?: ActorConfig;
}

/**
 * Store state for an actor
 */
interface ActorStoreState<T> {
  actor: ActorSubclass<T> | undefined;
  isInitializing: boolean;
  isAuthenticated: boolean;
  error: Error | undefined;
}

/**
 * Store events for an actor
 */
interface ActorStoreEvents<T> {
  setState: Partial<ActorStoreState<T>>;
  reset: {};
}

/**
 * Return type of the useActor hook
 */
export interface UseActorReturn<T> {
  /** The actor instance, initialized with anonymous agent by default */
  actor: ActorSubclass<T> | undefined;
  /** Whether the actor is currently being initialized or authenticated */
  isInitializing: boolean;
  /** Whether the actor is authenticated with a non-anonymous identity */
  isAuthenticated: boolean;
  /** Any error that occurred during initialization, authentication, or setting up interceptors */
  error: Error | undefined;
  /** Authenticate the actor with the provided identity by replacing the anonymous identity */
  authenticate: (identity: Identity) => Promise<void>;
  /** Set up or update interceptors for request/response handling */
  setInterceptors: (interceptors: InterceptorOptions) => void;
  /** Reset the actor state and reinitialize with anonymous agent */
  reset: () => void;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Creates an interceptor proxy for the actor to handle request/response callbacks
 */
function createInterceptorProxy<T>(
  actor: ActorSubclass<T>,
  interceptors?: InterceptorOptions,
): ActorSubclass<T> {
  if (!interceptors) {
    return actor;
  }
  return new Proxy(actor, {
    get(target, prop, receiver) {
      const originalProperty = Reflect.get(target, prop, receiver);
      if (typeof originalProperty === "function") {
        return async (...args: unknown[]) => {
          try {
            if (interceptors.onRequest) {
              args = interceptors.onRequest({
                methodName: prop as string,
                args,
              });
            }
            const response = await originalProperty.apply(target, args);
            if (interceptors.onResponse) {
              return interceptors.onResponse({
                methodName: prop as string,
                args,
                response,
              });
            }
            return response;
          } catch (error) {
            if (error instanceof TypeError) {
              if (interceptors.onRequestError) {
                error = interceptors.onRequestError({
                  methodName: prop as string,
                  args,
                  error,
                });
              }
            } else {
              if (interceptors.onResponseError) {
                error = interceptors.onResponseError({
                  methodName: prop as string,
                  args,
                  error,
                });
              }
            }
            throw error;
          }
        };
      }
      return originalProperty;
    },
  });
}

/**
 * Creates a React hook for interacting with an Internet Computer canister.
 * This hook manages the actor lifecycle and provides a simple interface for components.
 * The actor is initialized immediately with an anonymous agent, allowing unauthenticated calls.
 *
 * @param options - Configuration options for the actor store
 * @returns A hook function that provides actor instance and control methods
 *
 * @example
 * ```ts
 * // Setup in your actors file
 * import { createActorStore } from "ic-use-actor";
 * import { canisterId, idlFactory } from "./declarations/backend";
 * import { _SERVICE } from "./declarations/backend/backend.did";
 *
 * export const useBackendActor = createActorStore<_SERVICE>({
 *   canisterId,
 *   idlFactory,
 * });
 *
 * // Use in your components
 * function MyComponent() {
 *   const { actor, authenticate, setInterceptors, isAuthenticated } = useBackendActor();
 *   const { identity, clear } = useSiweIdentity();
 *
 *   useEffect(() => {
 *     // Set up interceptors once - they persist across authentication changes
 *     setInterceptors({
 *       onResponseError: (data) => {
 *         // Check if identity expired and clear it
 *         if (data.error.message?.includes("delegation expired")) {
 *           clear();
 *         }
 *         return data.error;
 *       }
 *     });
 *   }, [setInterceptors, clear]);
 *
 *   useEffect(() => {
 *     if (identity) {
 *       authenticate(identity);
 *     }
 *   }, [identity, authenticate]);
 *
 *   const handleClick = async () => {
 *     if (actor) {
 *       // Works with both anonymous and authenticated calls
 *       const result = await actor.someMethod();
 *       console.log(result);
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Call Method</button>;
 * }
 * ```
 */
export function createActorStore<T>(
  options: CreateActorStoreOptions,
): () => UseActorReturn<T> {
  let _actor: ActorSubclass<T> | undefined;

  // Create the store instance
  const store = createStore({
    context: {
      actor: undefined as ActorSubclass<T> | undefined,
      isInitializing: false,
      isAuthenticated: false,
      error: undefined as Error | undefined,
    },
    on: {
      setState: (
        context: ActorStoreState<T>,
        event: Partial<ActorStoreState<T>>,
      ) => ({
        ...context,
        ...event,
      }),
      reset: () => ({
        actor: undefined as ActorSubclass<T> | undefined,
        isInitializing: false,
        isAuthenticated: false,
        error: undefined as Error | undefined,
      }),
    },
  });

  // Initialize the actor immediately with an anonymous agent
  // This allows the actor to be used for unauthenticated calls right away
  const initializeActor = async () => {
    try {
      store.send({ type: "setState" as const, isInitializing: true });

      const shouldFetchRootKey = process.env.DFX_NETWORK !== "ic";
      const agent = await HttpAgent.create({
        ...options.httpAgentOptions,
        shouldFetchRootKey,
      });

      _actor = Actor.createActor<T>(options.idlFactory, {
        agent,
        canisterId: options.canisterId,
        ...options.actorOptions,
      });

      store.send({
        type: "setState" as const,
        actor: _actor,
        isInitializing: false,
        isAuthenticated: false,
        error: undefined,
      });
    } catch (error) {
      store.send({
        type: "setState" as const,
        error: error instanceof Error ? error : new Error(String(error)),
        isInitializing: false,
        isAuthenticated: false,
      });
    }
  };

  // Initialize on creation
  initializeActor();

  // Authenticate function that replaces the anonymous identity with the provided one
  // This allows the same actor instance to be used for authenticated calls
  const authenticate = async (identity: Identity) => {
    try {
      store.send({ type: "setState" as const, isInitializing: true });

      if (!_actor) {
        throw new Error("No actor found");
      }

      const agent = Actor.agentOf(_actor);
      if (!agent) {
        throw new Error("No agent found for actor");
      }
      agent.replaceIdentity!(identity);

      store.send({
        type: "setState" as const,
        isInitializing: false,
        isAuthenticated: true,
        error: undefined,
      });
    } catch (error) {
      store.send({
        type: "setState" as const,
        error: error instanceof Error ? error : new Error(String(error)),
        isInitializing: false,
        isAuthenticated: false,
      });
    }
  };

  // Set up or update interceptors for request/response handling
  // Interceptors are applied as a proxy over the existing actor
  const setInterceptors = (interceptors: InterceptorOptions) => {
    try {
      if (!_actor) {
        throw new Error("No actor found");
      }
      const proxiedActor = createInterceptorProxy(_actor, interceptors);
      store.send({ type: "setState" as const, actor: proxiedActor });
    } catch (error) {
      store.send({
        type: "setState" as const,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  // The hook that components will use to interact with the actor
  return function useActor(): UseActorReturn<T> {
    const actor = useSelector(store, (state) => state.context.actor);
    const isInitializing = useSelector(
      store,
      (state) => state.context.isInitializing,
    );
    const isAuthenticated = useSelector(
      store,
      (state) => state.context.isAuthenticated,
    );
    const error = useSelector(store, (state) => state.context.error);

    return {
      actor,
      isInitializing,
      isAuthenticated,
      error,
      authenticate,
      setInterceptors,
      reset: () => {
        _actor = undefined;
        store.send({ type: "reset" as const });
        initializeActor();
      },
      clearError: () =>
        store.send({ type: "setState" as const, error: undefined }),
    };
  };
}

/**
 * @deprecated Use `createActorStore` instead. This export is provided for backwards compatibility.
 */
export const createUseActorHook = createActorStore;

/**
 * @deprecated Context-based actors are no longer needed. Use `createActorStore` instead.
 */
export function createActorContext<T>() {
  console.warn(
    "createActorContext is deprecated. Use createActorStore instead.",
  );
  return null as any;
}

/**
 * @deprecated The ActorProvider component is no longer needed. Use `createActorStore` instead.
 */
export function ActorProvider(_props: any) {
  console.warn("ActorProvider is deprecated. Use createActorStore instead.");
  return null;
}
