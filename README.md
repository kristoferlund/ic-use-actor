# ic-use-actor

A React hook library for interacting with Internet Computer (IC) canisters. `ic-use-actor` provides a simple, type-safe way to interact with IC actors using XState stores for state management.

[![version][version-image]][npm-link]
[![downloads][dl-image]][npm-link]

## Features

- **Simple API**: Just one function call to create a typed hook for your canister
- **No Provider Hell**: No need for React Context or Provider components
- **Type Safety**: Full TypeScript support with canister service definitions
- **Request/Response Interceptors**: Process requests and responses with customizable callbacks
- **Global State Management**: Powered by XState stores for predictable state management
- **Multiple Canisters**: Easy to work with multiple canisters without nesting providers

## Table of Contents

- [ic-use-actor](#ic-use-actor)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Usage](#usage)
    - [Basic Setup](#basic-setup)
    - [Using in Components](#using-in-components)
    - [Multiple Canisters](#multiple-canisters)
  - [Advanced Usage](#advanced-usage)
    - [Interceptors](#interceptors)
    - [Error Handling](#error-handling)
    - [Custom HTTP Agent Options](#custom-http-agent-options)
  - [API Reference](#api-reference)
    - [createActorHook](#createactorhook)
    - [Hook Return Value](#hook-return-value)
    - [Global Helpers](#global-helpers)
  - [Migration from v0.1.x](#migration-from-v01x)
  - [Examples](#examples)
  - [Author](#author)
  - [Contributing](#contributing)
  - [License](#license)

## Installation

```bash
npm install ic-use-actor @dfinity/agent @dfinity/candid @xstate/store
```

or

```bash
yarn add ic-use-actor @dfinity/agent @dfinity/candid @xstate/store
```

or

```bash
pnpm add ic-use-actor @dfinity/agent @dfinity/candid @xstate/store
```

## Quick Start

```tsx
// 1. Create your actor hook
import { createActorHook } from "ic-use-actor";
import { canisterId, idlFactory } from "./declarations/my_canister";
import { _SERVICE } from "./declarations/my_canister/my_canister.did";

export const useMyCanister = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
});

// 2. Use it in your components
function MyComponent() {
  const { actor: myCanister, authenticate, isAuthenticated, status, isInitializing, isSuccess, isError, error } = useMyCanister();
  const { identity } = useInternetIdentity(); // or any identity provider

  // Authenticate when identity is available (keeps initialization separate from authentication)
  useEffect(() => {
    if (identity) {
      void authenticate(identity);
    }
  }, [identity, authenticate]);

  const handleClick = async () => {
    if (!myCanister) return;
    const result = await myCanister.myMethod();
    console.log(result);
  };

  if (error) return <div>Error: {error.message}</div>;
  if (isInitializing) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please sign in</div>;

  return <button onClick={handleClick}>Call Canister</button>;
}

// 3. That's it!
function App() {
  return <MyComponent />;
}
```

## Usage

### Basic Setup

Create a hook for your canister by calling `createActorHook` with your canister's configuration:

```tsx
// actors.ts
import { createActorHook } from "ic-use-actor";
import { canisterId, idlFactory } from "./declarations/backend";
import { _SERVICE } from "./declarations/backend/backend.did";

export const useBackendActor = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
});
```

### Using in Components

The hook returns an object with the actor instance and several utility functions:

```tsx
function MyComponent() {
  const {
    actor,           // The actor instance (initialized with anonymous agent by default)
    authenticate,    // Function to authenticate the actor with an identity
    setInterceptors, // Function to set up interceptors
    isAuthenticated, // Boolean indicating if actor is authenticated
    status,          // 'initializing' | 'success' | 'error'
    isInitializing,  // status === 'initializing'
    isSuccess,       // status === 'success'
    isError,         // status === 'error'
    error,           // Any error that occurred during initialization
    reset,           // Function to reset the actor state
    clearError       // Function to clear error state
  } = useBackendActor();

  const { identity } = useInternetIdentity();

  // Authenticate when identity is available
  useEffect(() => {
    if (identity) {
      void authenticate(identity);
    }
  }, [identity, authenticate]);

  // Use the actor (works with anonymous or authenticated)
  const fetchData = async () => {
    if (!actor) return;
    try {
      const data = await actor.getData();
      console.log(data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  };

  return (
    <div>
      {error && <div>Error: {error.message}</div>}
      {status === "initializing" && <div>Initializing...</div>}
      <button onClick={fetchData} disabled={!actor}>Fetch Data</button>
      {isAuthenticated && <span>Authenticated</span>}
    </div>
  );
}
```

The hook function also exposes non-React helpers that can be used outside components, for example in route guards:

```ts
// Wait for the hook to finish initial setup
await useBackendActor.ensureInitialized();
// Inspect helper predicates
if (useBackendActor.isInitializing()) { /* still initializing */ }
if (useBackendActor.isSuccess()) { /* initialized successfully */ }
if (useBackendActor.isError()) { /* initialization failed */ }
// Check authentication helper
if (useBackendActor.isAuthenticated()) { /* identity attached */ }
// Get actor instance (may be undefined if not initialized)
const actor = useBackendActor.getActor();
// Authenticate the hook with an identity
await useBackendActor.authenticate(identity);
```

### Multiple Canisters

Create a hook for each canister:

```tsx
// actors.ts
export const useBackendOne = createActorHook<BackendOneService>({
  canisterId: backendOneCanisterId,
  idlFactory: backendOneIdlFactory,
});

export const useBackendTwo = createActorHook<BackendTwoService>({
  canisterId: backendTwoCanisterId,
  idlFactory: backendTwoIdlFactory,
});
```

Authenticate each hook when an identity becomes available (in a component):

```tsx
function MultiCanisterComponent() {
  const { identity } = useInternetIdentity();
  const backendOne = useBackendOne();
  const backendTwo = useBackendTwo();

  useEffect(() => {
    if (identity) {
      void backendOne.authenticate(identity);
      void backendTwo.authenticate(identity);
    }
  }, [identity, backendOne, backendTwo]);

  // Use the actors...
}
```

### Router integration

When using a routing library (e.g. TanStack Router) you can initialize the Internet Identity library and then ensure and authenticate your actor hooks before a route loads.

Available functions:

- `ensureAllInitialized(): Promise<void>` — wait for all registered actor hooks to finish their initial anonymous setup
- `authenticateAll(identity: Identity, filterCanisterIds?: string[]): Promise<void>` — authenticate all (or a filtered subset) of registered hooks with the provided identity
- Per-hook helpers attached to the hook function: `useMyActor.ensureInitialized()`, `useMyActor.authenticate(identity)`, `useMyActor.getActor()`, `useMyActor.isAuthenticated()`

Basic example (TanStack Router):

```ts
import { createRoute, redirect } from "@tanstack/react-router";
import { ensureInitialized as ensureIdentityInitialized } from "ic-use-internet-identity";
import { ensureAllInitialized, authenticateAll } from "ic-use-actor";
import { useBackendOne, useBackendTwo } from "./actors";

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "dashboard",
  beforeLoad: async () => {
    // 1. Ensure the identity library has finished restoring any cached identity
    const identity = await ensureIdentityInitialized();
    if (!identity) {
      throw redirect({ to: "/login" });
    }

    // 2. Wait for actor hooks to initialize (anonymous agents created)
    await ensureAllInitialized();

    // 3. Authenticate all registered actor hooks with the restored identity
    await authenticateAll(identity);

    // Alternatively authenticate specific hooks:
    // await useBackendOne.ensureInitialized();
    // await useBackendOne.authenticate(identity);
    // await useBackendTwo.ensureInitialized();
    // await useBackendTwo.authenticate(identity);
  },
  component: DashboardComponent,
});
```

Important notes:

- Always await the Internet Identity initialization first (`ic-use-internet-identity.ensureInitialized()`).
- `beforeLoad` runs once during navigation and does not react to later authentication changes — use a reactive component to observe auth changes at runtime.

## Advanced Usage

### Interceptors

Add request/response interceptors to proxy and process or log interactions with your canister. Interceptors intercept booth outgoing requests and incoming responses as well as errors.

```tsx
function MyComponent() {
  const { actor, authenticate, setInterceptors } = useBackendActor();
  const { identity, logout } = useAuthProvider();
  const navigate = useNavigate();

  // Set up interceptors once - they can access React hooks
  useEffect(() => {
    setInterceptors({
      // Called before each request
      onRequest: (data) => {
        console.log(`Calling ${data.methodName}`, data.args);
        // Modify args if needed
        return data.args;
      },

      // Called after successful responses
      onResponse: (data) => {
        console.log(`Response from ${data.methodName}`, data.response);
        // Modify response if needed
        return data.response;
      },

      // Called on request errors (e.g., network issues)
      onRequestError: (data) => {
        console.error(`Request error in ${data.methodName}`, data.error);
        // Transform or handle error
        return data.error;
      },

      // Called on response errors - can access React hooks here!
      onResponseError: (data) => {
        console.error(`Response error in ${data.methodName}`, data.error);

        // Check for expired identity and handle it
        if (data.error.message?.includes("delegation expired")) {
          logout(); // Call React hook function
          navigate('/login'); // Use React Router
        }

        return data.error;
      },
    });
  }, [setInterceptors, logout, navigate]);

  // Authenticate when identity is available
  useEffect(() => {
    if (identity) {
      authenticate(identity);
    }
  }, [identity, authenticate]);

  // ... rest of component
}
```

### Error Handling

The hook provides error state that you can use to handle initialization errors:

```tsx
function MyComponent() {
  const { actor, error, clearError, authenticate } = useBackendActor();
  const { identity } = useSiweIdentity();

  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={() => {
          clearError();
          if (identity) {
            authenticate(identity);
          }
        }}>
          Retry
        </button>
      </div>
    );
  }

  // ...
}
```

### Custom HTTP Agent Options

Configure the HTTP agent with custom options:

```tsx
export const useBackendActor = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
  httpAgentOptions: {
    host: "https://ic0.app",
    credentials: "include",
    headers: {
      "X-Custom-Header": "value",
    },
  },
  actorOptions: {
    callTransform: (methodName, args, callConfig) => {
      // Transform calls before sending
      return [methodName, args, callConfig];
    },
    queryTransform: (methodName, args, callConfig) => {
      // Transform queries before sending
      return [methodName, args, callConfig];
    },
  },
});
```

## API Reference

### createActorHook

Creates a React hook for interacting with an IC canister.

```typescript
function createActorHook<T>(options: CreateActorHookOptions<T>): () => UseActorReturn<T>
```

#### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `canisterId` | `string` | Yes | The canister ID |
| `idlFactory` | `IDL.InterfaceFactory` | Yes | The IDL factory for the canister |
| `httpAgentOptions` | `HttpAgentOptions` | No | Options for the HTTP agent |
| `actorOptions` | `ActorConfig` | No | Options for the actor |


### Hook Return Value

The hook returns runtime state and helpers for interacting with the actor:

```typescript
interface UseActorReturn<T> {
  actor: ActorSubclass<T> | undefined;

  // Initialization status: 'initializing' | 'success' | 'error'
  status: "initializing" | "success" | "error";
  // Convenience booleans derived from `status`
  isInitializing: boolean; // status === 'initializing'
  isSuccess: boolean;      // status === 'success' (actor instance created)
  isError: boolean;        // status === 'error'

  // Authentication flag (separate from initialization)
  isAuthenticated: boolean; // whether an identity has been attached

  // Any error that occurred during initialization or authentication
  error?: Error;

  // Helpers
  authenticate: (identity: Identity) => Promise<void>;
  setInterceptors: (interceptors: InterceptorOptions) => void;
  reset: () => void;
  clearError: () => void;
}
```

Notes:
- `isSuccess` means the actor instance was successfully created (initialization completed). It does NOT imply the actor has been authenticated — use `isAuthenticated` to check identity attachment.
- `authenticate(identity)` attaches the identity to the actor's agent (no network calls) and updates `isAuthenticated`.

Non-react helpers (attached to the hook function)

Each hook function also exposes helpers you can call outside React (useful for route guards):

- `ensureInitialized(): Promise<ActorSubclass<T> | undefined>` — wait for the hook's initial actor initialization to complete.
- `authenticate(identity: Identity): Promise<void>` — attach an identity to the actor (same as the hook method).
- `getActor(): ActorSubclass<T> | undefined` — get the current actor instance (may be proxied by interceptors).
- `isAuthenticated(): boolean` — whether an identity is attached.
- `isInitializing(): boolean` — predicate for initialization in progress.
- `isSuccess(): boolean` — predicate for initialization success.
- `isError(): boolean` — predicate for initialization error.

Example:

```ts
await useBackendActor.ensureInitialized();
if (!useBackendActor.isSuccess()) throw new Error('Actor failed to initialize');
if (!useBackendActor.isAuthenticated()) await useBackendActor.authenticate(identity);
const actor = useBackendActor.getActor();
```

Property summary

| Property | Type | Description |
|----------|------|-------------|
| `actor` | `ActorSubclass<T> | undefined` | The actor instance (initialized with anonymous agent by default) |
| `status` | `"initializing" | "success" | "error"` | Initialization status of the actor (only initialization) |
| `isInitializing` | `boolean` | `status === "initializing"` |
| `isSuccess` | `boolean` | `status === "success"` (actor instance created) |
| `isError` | `boolean` | `status === "error"` |
| `isAuthenticated` | `boolean` | Whether an identity has been attached to the actor |
| `error` | `Error | undefined` | Any error that occurred during initialization or authentication |
| `authenticate` | `(identity: Identity) => Promise<void>` | Attach an identity to the actor's agent |
| `setInterceptors` | `(interceptors: InterceptorOptions) => void` | Apply request/response interceptors to the actor |
| `reset` | `() => void` | Reset the actor state and reinitialize |
| `clearError` | `() => void` | Clear stored error state |

### Global Helpers

Helpers that operate across all registered hook instances (useful when your app creates multiple actor hooks):

- `ensureAllInitialized(): Promise<void>` — waits for every registered hook to finish its initial anonymous setup. Useful in route guards where you want all actor hooks ready.

- `authenticateAll(identity: Identity, filterCanisterIds?: string[]): Promise<void>` — attaches the provided identity to all registered hooks; if `filterCanisterIds` is supplied only hooks whose `canisterId` is included will be authenticated. Throws if any hook's authentication fails.

- `authenticateCanister(identity: Identity, canisterId: string): Promise<void>` — convenience wrapper to authenticate hooks for a specific canister id.

Example (router integration):

```ts
import { ensureAllInitialized, authenticateAll } from 'ic-use-actor';
import { ensureInitialized as ensureIdentityInitialized } from 'ic-use-internet-identity';

const identity = await ensureIdentityInitialized();
if (!identity) throw redirect('/login');
await ensureAllInitialized();
await authenticateAll(identity);
```


### Notes on global helpers

- `ensureAllInitialized` only waits for the initial anonymous `HttpAgent` + actor creation — it does not authenticate hooks.
- `authenticateAll` will call each hook's `authenticate` helper which updates the per-hook `isAuthenticated` flag.

## Migration from v0.1.x

If you're upgrading from v0.1.x, check out the [Migration Guide](MIGRATION.md) for detailed instructions on updating your code to use the new API.

## Author

- [kristofer@fmckl.se](mailto:kristofer@fmckl.se)
- Twitter: [@kristoferlund](https://twitter.com/kristoferlund)
- Discord: kristoferkristofer
- Telegram: [@kristoferkristofer](https://t.me/kristoferkristofer)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

[version-image]: https://img.shields.io/npm/v/ic-use-actor.svg?style=flat-square
[dl-image]: https://img.shields.io/npm/dm/ic-use-actor.svg?style=flat-square
[npm-link]: https://www.npmjs.com/package/ic-use-actor
