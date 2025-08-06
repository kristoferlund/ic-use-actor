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
    - [Auto-initialization](#auto-initialization)
  - [Advanced Usage](#advanced-usage)
    - [Interceptors](#interceptors)
    - [Error Handling](#error-handling)
    - [Custom HTTP Agent Options](#custom-http-agent-options)
  - [API Reference](#api-reference)
    - [createActorStore](#createactorstore)
    - [createAutoInitActorStore](#createautoinitactorstore)
    - [Hook Return Value](#hook-return-value)
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
import { createActorStore } from "ic-use-actor";
import { canisterId, idlFactory } from "./declarations/backend";
import { _SERVICE } from "./declarations/backend/backend.did";

export const useBackendActor = createActorStore<_SERVICE>({
  canisterId,
  idlFactory,
});

// 2. Use it in your components
function MyComponent() {
  const { actor, authenticate, setInterceptors, isAuthenticated, isInitializing, error } = useBackendActor();
  const { identity, clear } = useSiweIdentity(); // or any identity provider
  
  useEffect(() => {
    // Set up interceptors once
    setInterceptors({
      onResponseError: (data) => {
        if (data.error.message?.includes("delegation expired")) {
          clear(); // Clear identity from React hook
        }
        return data.error;
      }
    });
  }, [setInterceptors, clear]);
  
  useEffect(() => {
    if (identity) {
      authenticate(identity);
    }
  }, [identity, authenticate]);
  
  const handleClick = async () => {
    if (!actor) return;
    const result = await actor.myMethod();
    console.log(result);
  };
  
  if (error) return <div>Error: {error.message}</div>;
  if (isInitializing) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please sign in</div>;
  
  return <button onClick={handleClick}>Call Canister</button>;
}

// 3. That's it! No providers needed in your App
function App() {
  return <MyComponent />;
}
```

## Usage

### Basic Setup

Create a hook for your canister by calling `createActorStore` with your canister's configuration:

```tsx
// actors.ts
import { createActorStore } from "ic-use-actor";
import { canisterId, idlFactory } from "./declarations/backend";
import { _SERVICE } from "./declarations/backend/backend.did";

export const useBackendActor = createActorStore<_SERVICE>({
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
    isInitializing,  // Boolean indicating if actor is being initialized
    error,          // Any error that occurred during initialization
    reset,          // Function to reset the actor state
    clearError      // Function to clear error state
  } = useBackendActor();
  
  const { identity, clear } = useSiweIdentity();
  
  // Set up interceptors once
  useEffect(() => {
    setInterceptors({
      onRequest: (data) => {
        console.log(`Calling ${data.methodName}`, data.args);
        return data.args;
      },
      onResponseError: (data) => {
        // Access React hooks in interceptors
        if (data.error.message?.includes("delegation expired")) {
          clear(); // Clear identity when expired
        }
        return data.error;
      }
    });
  }, [setInterceptors, clear]);
  
  // Authenticate when identity is available
  useEffect(() => {
    if (identity) {
      authenticate(identity);
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
      {isInitializing && <div>Initializing...</div>}
      <button onClick={fetchData} disabled={!actor}>Fetch Data</button>
      {isAuthenticated && <span>Authenticated</span>}
    </div>
  );
}
```

### Multiple Canisters

Working with multiple canisters is straightforward - just create a hook for each:

```tsx
// actors.ts
export const useBackendActor = createActorStore<BackendService>({
  canisterId: backendCanisterId,
  idlFactory: backendIdlFactory,
});

export const useNFTActor = createActorStore<NFTService>({
  canisterId: nftCanisterId,
  idlFactory: nftIdlFactory,
});

export const useTokenActor = createActorStore<TokenService>({
  canisterId: tokenCanisterId,
  idlFactory: tokenIdlFactory,
});

// Component using multiple actors
function MultiCanisterComponent() {
  const { identity } = useSiweIdentity();
  const backend = useBackendActor();
  const nft = useNFTActor();
  const token = useTokenActor();
  
  useEffect(() => {
    if (identity) {
      backend.authenticate(identity);
      nft.authenticate(identity);
      token.authenticate(identity);
    }
  }, [identity]);
  
  // Use the actors...
}
```

### Auto-initialization

If you have a global identity store, you can use `createAutoInitActorStore` for automatic initialization:

```tsx
// actors.ts
import { createAutoInitActorStore } from "ic-use-actor";
import { identityStore } from "./stores/identity";

export const useBackendActor = createAutoInitActorStore<_SERVICE>({
  canisterId,
  idlFactory,
  getIdentity: () => identityStore.getState().identity,
  getInterceptors: () => ({
    onResponseError: (data) => {
      if (data.error.message?.includes("delegation expired")) {
        identityStore.clear();
      }
      return data.error;
    }
  })
});

// Component - no manual initialization needed!
function MyComponent() {
  const { actor, isInitializing } = useBackendActor();
  
  if (isInitializing) return <div>Loading...</div>;
  if (!actor) return <div>Please sign in</div>;
  
  return <button onClick={() => actor.myMethod()}>Call Method</button>;
}
```

## Advanced Usage

### Interceptors

Add request/response interceptors to process or log interactions with your canister. Interceptors are provided when initializing the actor, allowing them to access React context and hooks:

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
export const useBackendActor = createActorStore<_SERVICE>({
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

### createActorStore

Creates a React hook for interacting with an IC canister.

```typescript
function createActorStore<T>(options: CreateActorStoreOptions<T>): () => UseActorReturn<T>
```

#### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `canisterId` | `string` | Yes | The canister ID |
| `idlFactory` | `IDL.InterfaceFactory` | Yes | The IDL factory for the canister |
| `httpAgentOptions` | `HttpAgentOptions` | No | Options for the HTTP agent |
| `actorOptions` | `ActorConfig` | No | Options for the actor |


### createAutoInitActorStore

Creates a React hook with automatic initialization when identity becomes available.

```typescript
function createAutoInitActorStore<T>(
  options: CreateActorStoreOptions<T> & {
    getIdentity: () => Identity | undefined;
  }
): () => UseActorReturn<T>
```

#### Additional Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `getIdentity` | `() => Identity \| undefined` | Yes | Function to retrieve the current identity |

### Hook Return Value

Both `createActorStore` and `createAutoInitActorStore` return hooks that provide:

```typescript
interface UseActorReturn<T> {
  actor: ActorSubclass<T> | undefined;
  isInitializing: boolean;
  isAuthenticated: boolean;
  error: Error | undefined;
  authenticate: (identity: Identity) => Promise<void>;
  setInterceptors: (interceptors: InterceptorOptions) => void;
  reset: () => void;
  clearError: () => void;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `actor` | `ActorSubclass<T> \| undefined` | The actor instance (initialized with anonymous agent by default) |
| `isInitializing` | `boolean` | Whether the actor is being initialized |
| `isAuthenticated` | `boolean` | Whether the actor is authenticated with a non-anonymous identity |
| `error` | `Error \| undefined` | Any error that occurred during initialization or authentication |
| `authenticate` | `(identity: Identity) => Promise<void>` | Function to authenticate the actor with an identity |
| `setInterceptors` | `(interceptors: InterceptorOptions) => void` | Function to set up interceptors |
| `reset` | `() => void` | Function to reset the actor state |
| `clearError` | `() => void` | Function to clear error state |

## Migration from v0.1.x

If you're upgrading from v0.1.x, check out the [Migration Guide](MIGRATION.md) for detailed instructions on updating your code to use the new API.

## Examples

### With ic-use-siwe-identity

```tsx
import { createActorStore } from "ic-use-actor";
import { useSiweIdentity } from "ic-use-siwe-identity";

export const useBackendActor = createActorStore<_SERVICE>({
  canisterId,
  idlFactory,
});

function App() {
  const { identity, isInitializing: isIdentityInitializing, clear } = useSiweIdentity();
  const { actor, authenticate, setInterceptors, isAuthenticated, isInitializing: isActorInitializing } = useBackendActor();
  
  useEffect(() => {
    // Set up interceptors once
    setInterceptors({
      onResponseError: (data) => {
        if (data.error.message?.includes("delegation expired")) {
          clear(); // Clear identity when expired
        }
        return data.error;
      }
    });
  }, [setInterceptors, clear]);
  
  useEffect(() => {
    if (identity) {
      authenticate(identity);
    }
  }, [identity, authenticate]);
  
  if (isIdentityInitializing || isActorInitializing) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <button onClick={login}>Sign In</button>;
  }
  
  return <YourApp actor={actor} />;
}
```

### With Internet Identity

```tsx
import { createActorStore } from "ic-use-actor";
import { AuthClient } from "@dfinity/auth-client";

export const useBackendActor = createActorStore<_SERVICE>({
  canisterId,
  idlFactory,
});

function App() {
  const [authClient, setAuthClient] = useState<AuthClient>();
  const { actor, authenticate, isAuthenticated } = useBackendActor();
  
  useEffect(() => {
    AuthClient.create().then(setAuthClient);
  }, []);
  
  const login = async () => {
    await authClient?.login({
      identityProvider: "https://identity.ic0.app",
      onSuccess: () => {
        const identity = authClient.getIdentity();
        authenticate(identity);
      },
    });
  };
  
  return isAuthenticated ? <YourApp actor={actor} /> : <button onClick={login}>Login</button>;
}
```

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