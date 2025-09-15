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
 * Configuration options for creating an actor hook
 */
export interface CreateActorHookOptions {
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
 * Actor status values (mirrors ic-use-internet-identity naming)
 */
export type ActorStatus =
  | "initializing"
  | "success"
  | "error";

/**
 * Store state for an actor
 */
interface ActorStoreState<T> {
  actor: ActorSubclass<T> | undefined;
  status: ActorStatus;
  error: Error | undefined;
  isAuthenticated: boolean;
}

/**
 * Store events for an actor
 */
/**
 * Return type of the useActor hook
 */
export interface UseActorReturn<T> {
  /** The actor instance, initialized with anonymous agent by default */
  actor: ActorSubclass<T> | undefined;
  /** Status of the actor initialization (initializing | success | error) */
  status: ActorStatus;
  /** `status === "initializing"` */
  isInitializing: boolean;
  /** `status === "success"` — actor initialization completed successfully.
   *  Note: this only indicates the actor was created; it does NOT imply the actor
   *  has been authenticated with an identity. Use `isAuthenticated` to check whether
   *  an identity has been attached. */
  isSuccess: boolean;
  /** `status === "error"` */
  isError: boolean;
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

// Registry for created hooks so we can operate across multiple instances
type RegistryItem = {
  id: number;
  canisterId: string;
  ensureInitialized: () => Promise<ActorSubclass<any> | undefined>;
  /** Authenticate the hook instance with the provided Identity. */
  authenticate: (identity: Identity) => Promise<void>;
  getActor: () => ActorSubclass<any> | undefined;
  isAuthenticated: () => boolean;
};

const hookRegistry = new Map<number, RegistryItem>();
let nextHookId = 1;

/**
 * Creates a React hook for interacting with an Internet Computer canister.
 * This hook manages the actor lifecycle and provides a simple interface for components.
 * The actor is initialized immediately with an anonymous agent, allowing unauthenticated calls.
 *
 * Adds non-React helpers on the returned hook function so it can be used outside React
 * (for example in route guards) and registers the hook in a module-level registry so
 * multiple hooks can be authenticated en-masse.
 *
 * @param options - Configuration options for the actor store
 * @returns A hook function that provides actor instance and control methods
 */
type ActorHook<T> = {
  (): UseActorReturn<T>;
  ensureInitialized: () => Promise<ActorSubclass<T> | undefined>;
  authenticate: (identity: Identity) => Promise<void>;
  getActor: () => ActorSubclass<T> | undefined;
  isAuthenticated: () => boolean;
  isInitializing: () => boolean;
  isSuccess: () => boolean;
  isError: () => boolean;
};

/**
 * Factory that creates a React hook for interacting with an IC canister.
 *
 * The returned function is a React hook that provides the actor instance and
 * utility methods for components. The function object itself also exposes
 * non-React helpers (e.g. `ensureInitialized`, `authenticate`, `getActor`,
 * `isAuthenticated`, `isInitializing`, `isSuccess`, `isError`) so it can be
 * used outside React (for example in route guards).
 */
export function createActorHook<T>(
  options: CreateActorHookOptions,
): ActorHook<T> {
  const hookId = nextHookId++;
  let _actor: ActorSubclass<T> | undefined;

  // Initialization promise (resolves when initial anonymous actor is created)
  let initializationResolve: ((actor?: ActorSubclass<T>) => void) | null = null;
  let initializationReject: ((reason: Error) => void) | null = null;
  let initializationPromise: Promise<ActorSubclass<T> | undefined> = new Promise<ActorSubclass<T> | undefined>((resolve, reject) => {
    initializationResolve = resolve;
    initializationReject = reject;
  });

  /**
   * Create a fresh initialization promise.
   *
   * This promise is resolved when the anonymous actor has been created by
   * `initializeActor()`. It's recreated on `reset()` so callers can await the
   * next initialization cycle.
   */
  function createInitializationPromise() {
    initializationPromise = new Promise<ActorSubclass<T> | undefined>((resolve, reject) => {
      initializationResolve = resolve;
      initializationReject = reject;
    });
  }

  // Create the store instance using status strings (like ic-use-internet-identity)
  const store = createStore({
    context: {
      actor: undefined as ActorSubclass<T> | undefined,
      status: "initializing" as ActorStatus,
      error: undefined as Error | undefined,
      isAuthenticated: false,
    },
    on: {
      setState: (context: ActorStoreState<T>, event: Partial<ActorStoreState<T>>) => ({
        ...context,
        ...event,
      }),
      reset: () => ({
        actor: undefined as ActorSubclass<T> | undefined,
        status: "initializing" as ActorStatus,
        error: undefined as Error | undefined,
        isAuthenticated: false,
      }),
    },
  });

  /**
   * Initialize the actor with an anonymous `HttpAgent`.
   *
   * Creates the actor instance immediately so components can make unauthenticated
   * calls before an identity is attached. Resolves or rejects the internal
   * initialization promise accordingly.
   */
  const initializeActor = async () => {
    try {
      store.send({ type: "setState" as const, status: "initializing" });

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

      // Store the actor (unproxied). Consumers can add interceptors later.
      store.send({
        type: "setState" as const,
        actor: _actor,
        status: "success",
        error: undefined,
        isAuthenticated: false,
      });

      if (initializationResolve) {
        initializationResolve(_actor);
        initializationPromise = Promise.resolve(_actor);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      store.send({
        type: "setState" as const,
        status: "error",
        error: err,
      });

      if (initializationReject) {
        initializationReject(err);
        initializationPromise = Promise.reject(err);
      }
    }
  };

  // Kick off initialization
  initializeActor();

  /**
   * Wait for the initial anonymous actor initialization to complete.
   *
   * Resolves with the actor instance (or `undefined`) once initialization finishes,
   * or throws if initialization failed.
   */
  const ensureInitialized = async (): Promise<ActorSubclass<T> | undefined> => {
    const status = store.getSnapshot().context.status;

    if (status === "error") {
      const err = store.getSnapshot().context.error;
      throw err ?? new Error("Initialization failed");
    }

    if (status !== "initializing") {
      return store.getSnapshot().context.actor;
    }

    return initializationPromise;
  };

  /**
   * Attach the provided `identity` to the actor's agent.
   *
   * Waits for initial initialization then replaces the agent identity so future
   * calls are authenticated. This is synchronous from a network perspective
   * (no network requests are made here) — it only mutates the agent.
   *
   * @param identity - Identity to attach to the actor
   */
  const authenticate = async (identity: Identity) => {
    try {
      // Wait for initial actor to be ready first
      await ensureInitialized();

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
        isAuthenticated: true,
        error: undefined,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      store.send({
        type: "setState" as const,
        status: "error",
        error: err,
      });
      throw err;
    }
  };

  /**
   * Apply request/response interceptors to the actor.
   *
   * Wraps the current actor instance in a proxy that invokes the provided
   * interceptor callbacks around method calls.
   */
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
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  // Expose helpers for the registry and non-React helpers
  /** Get the current (possibly proxied) actor instance from the store snapshot. */
  const getActor = () => store.getSnapshot().context.actor;
  /** Whether an identity has been attached to this actor (independent of init). */
  const isAuthenticated = () => !!store.getSnapshot().context.isAuthenticated;
  /** Predicate helper: whether the actor is currently initializing. */
  const isInitializingHelper = () => store.getSnapshot().context.status === "initializing";
  /** Predicate helper: whether the actor initialized successfully. See docs for isSuccess. */
  const isSuccessHelper = () => store.getSnapshot().context.status === "success";
  /** Predicate helper: whether the actor initialization failed. */
  const isErrorHelper = () => store.getSnapshot().context.status === "error";

  // Register this hook instance in the module-level registry
  hookRegistry.set(hookId, {
    id: hookId,
    canisterId: options.canisterId,
    ensureInitialized: ensureInitialized as unknown as () => Promise<ActorSubclass<any> | undefined>,
    authenticate: authenticate as unknown as (identity: Identity) => Promise<void>,
    getActor: getActor as unknown as () => ActorSubclass<any> | undefined,
    isAuthenticated: isAuthenticated as unknown as () => boolean,
  });

  /**
   * React hook exposed to components.
   *
   * Returns the actor instance and runtime helpers. For usage outside React
   * (for example in route guards), use the helper methods attached to the hook
   * function itself (e.g. `useMyActor.ensureInitialized()`).
   */
  function useActor(): UseActorReturn<T> {
    const actor = useSelector(store, (state) => state.context.actor);
    const status = useSelector(store, (state) => state.context.status);
    const error = useSelector(store, (state) => state.context.error);
    const isAuthenticated = useSelector(store, (state) => state.context.isAuthenticated);

    return {
      actor,
      status,
      isInitializing: status === "initializing",
      isSuccess: status === "success",
      isError: status === "error",
      isAuthenticated,
      error,
      authenticate,
      setInterceptors,
      reset: () => {
        // Dispose and recreate initialization promise
        _actor = undefined;
        createInitializationPromise();
        store.send({ type: "reset" as const });
        initializeActor();
      },
      clearError: () => store.send({ type: "setState" as const, error: undefined }),
    };
  }

  // Attach non-react helpers directly to the hook function so consumers can call them outside React
  const useActorWithHelpers = Object.assign(useActor, {
    ensureInitialized,
    authenticate,
    getActor,
    isAuthenticated,
    isInitializing: isInitializingHelper,
    isSuccess: isSuccessHelper,
    isError: isErrorHelper,
  }) as ActorHook<T>;

  return useActorWithHelpers;
}

/**
 * Ensure all registered hooks have completed initialization.
 * Useful when you have multiple canister hooks and want to wait for them in a route guard.
 */
export async function ensureAllInitialized(): Promise<void> {
  const items = Array.from(hookRegistry.values());
  await Promise.all(items.map((it) => it.ensureInitialized()));
}

/**
 * Authenticate all registered hooks with the given identity.
 * Optionally filter by a list of canister IDs.
 * Throws if any hook fails to authenticate.
 */
export async function authenticateAll(
  identity: Identity,
  filterCanisterIds?: string[],
): Promise<void> {
  const items = Array.from(hookRegistry.values()).filter(
    (it) => !filterCanisterIds || filterCanisterIds.includes(it.canisterId),
  );

  const results = await Promise.allSettled(items.map((it) => it.authenticate(identity)));
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    const reasons = failed.map((r) => (r as PromiseRejectedResult).reason).join("; ");
    throw new Error(`authenticateAll failed for ${failed.length} hooks: ${reasons}`);
  }
}

/**
 * Authenticate hooks for a single canister id only.
 */
export async function authenticateCanister(identity: Identity, canisterId: string): Promise<void> {
  await authenticateAll(identity, [canisterId]);
}

/**
 * @deprecated Use `createActorHook` instead. This export is provided for backwards compatibility.
 */
export const createUseActorHook = createActorHook;

/**
 * @deprecated Context-based actors are no longer needed. Use `createActorHook` instead.
 */
export function createActorContext() {
  console.warn(
    "createActorContext is deprecated. Use createActorHook instead.",
  );
  return null as any;
}

/**
 * @deprecated The ActorProvider component is no longer needed. Use `createActorHook` instead.
 */
export function ActorProvider(_props: any) {
  console.warn("ActorProvider is deprecated. Use createActorHook instead.");
  return null;
}

