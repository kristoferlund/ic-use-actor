# Migration Guide: v0.1.x to v0.2.0

This guide will help you migrate from ic-use-actor v0.1.x to v0.2.0. Version 0.2.0 introduces a new, simpler API based on XState stores that eliminates the need for React Context and Provider components.

## Breaking Changes

### 1. Context and Provider Pattern Removed

The library no longer uses React Context and Provider components. Instead, it uses XState stores for global state management.

### 2. Removed Error Handling Utilities

The following error handling utilities have been removed since they are no longer needed and don't work with v3 of the `@dfinity/x` libraries:
- `AgentHTTPResponseError`
- `isAgentHTTPResponseError`
- `isIdentityExpiredError`

### 3. API Changes

- `createActorContext()` - Deprecated (no longer needed)
- `createUseActorHook()` - Deprecated (use `createActorHook()` instead)
- `ActorProvider` - Deprecated (no longer needed)

## Migration Steps

### Step 1: Update Your Actor Setup

#### Before (v0.1.x):
```tsx
import { createActorContext, createUseActorHook } from "ic-use-actor";
import { canisterId, idlFactory } from "./declarations/backend";
import { _SERVICE } from "./declarations/backend/backend.did";

// Create context and hook
const actorContext = createActorContext<_SERVICE>();
export const useBackendActor = createUseActorHook<_SERVICE>(actorContext);
```

#### After (v0.2.0):
```tsx
import { createActorHook } from "ic-use-actor";
import { canisterId, idlFactory } from "./declarations/backend";
import { _SERVICE } from "./declarations/backend/backend.did";

// Create hook directly - no context needed!
export const useBackendActor = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
});
```

### Step 2: Remove Provider Components

#### Before (v0.1.x):
```tsx
import { ActorProvider } from "ic-use-actor";
import { useSiweIdentity } from "ic-use-siwe-identity";

export function BackendActorProvider({ children }: { children: ReactNode }) {
  const { identity } = useSiweIdentity();

  return (
    <ActorProvider<_SERVICE>
      canisterId={canisterId}
      context={actorContext}
      identity={identity}
      idlFactory={idlFactory}
    >
      {children}
    </ActorProvider>
  );
}

// In App.tsx
function App() {
  return (
    <BackendActorProvider>
      <YourComponents />
    </BackendActorProvider>
  );
}
```

#### After (v0.2.0):
```tsx
// No provider needed! Just use your components directly
function App() {
  return <YourComponents />;
}
```

### Step 3: Update Component Usage

#### Before (v0.1.x):
```tsx
function MyComponent() {
  const { actor } = useBackendActor();

  const handleClick = async () => {
    if (actor) {
      const result = await actor.someMethod();
      console.log(result);
    }
  };

  return <button onClick={handleClick}>Call Method</button>;
}
```

#### After (v0.2.0):
```tsx
function MyComponent() {
  const { actor, authenticate, setInterceptors, isAuthenticated, isInitializing, error } = useBackendActor();
  const { identity, clear } = useSiweIdentity();

  // Set up interceptors once - can access React hooks and context
  useEffect(() => {
    setInterceptors({
      onRequest: (data) => {
        console.log(`Calling ${data.methodName}`, data.args);
        // Modify args if needed
        return data.args;
      },
    });
  }, [setInterceptors, clear]);

  // Authenticate actor when identity is available
  useEffect(() => {
    if (identity) {
      authenticate(identity);
    }
  }, [identity, authenticate]);

  const handleClick = async () => {
    if (actor) {
      const result = await actor.someMethod();
      console.log(result);
    }
  };

  if (error) return <div>Error: {error.message}</div>;
  if (isInitializing) return <div>Initializing...</div>;

  return <button onClick={handleClick}>Call Method</button>;
}
```

### Step 4: Multiple Canisters

#### Before (v0.1.x):
```tsx
// Need to create context, hook, and provider for each canister
const backendContext = createActorContext<BackendService>();
const nftContext = createActorContext<NFTService>();

export const useBackendActor = createUseActorHook<BackendService>(backendContext);
export const useNFTActor = createUseActorHook<NFTService>(nftContext);

// Nested providers in App
function App() {
  return (
    <BackendActorProvider>
      <NFTActorProvider>
        <YourComponents />
      </NFTActorProvider>
    </BackendActorProvider>
  );
}
```

#### After (v0.2.0):
```tsx
// Just create hooks - no providers needed!
export const useBackendActor = createActorHook<BackendService>({
  canisterId: backendCanisterId,
  idlFactory: backendIdlFactory,
});

export const useNFTActor = createActorHook<NFTService>({
  canisterId: nftCanisterId,
  idlFactory: nftIdlFactory,
});

// Clean App component
function App() {
  return <YourComponents />;
}
```

## Advanced Features

### Interceptors

Interceptors are now set up separately using `setInterceptors()`, allowing them to access React hooks and context:

```tsx
function MyComponent() {
  const { actor, authenticate, setInterceptors } = useBackendActor();
  const { identity, logout } = useAuthProvider();
  const navigate = useNavigate();

  // Set up interceptors once - they can access React hooks
  useEffect(() => {
    setInterceptors({
      onRequest: (data) => {
        console.log(`Calling ${data.methodName}`, data.args);
        return data.args;
      },
      onResponse: (data) => {
        console.log(`Response from ${data.methodName}`, data.response);
        return data.response;
      },
      onResponseError: (data) => {
        console.error(`Error in ${data.methodName}`, data.error);
        // Can access React hooks!
        if (data.error.message?.includes("delegation expired")) {
          logout(); // Call hook function
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

This separation allows interceptors to be set up once and persist across authentication changes, while still having access to React hooks and context for handling authentication errors, navigation, and other side effects.

## Benefits of the New API

1. **Less Boilerplate**: No need to create contexts and providers
2. **Simpler Setup**: One function call per canister
3. **No Provider Hell**: Clean component tree without nested providers
4. **Better Testing**: No need to wrap components in providers for tests
5. **Global State**: Actor state persists across component unmounts
6. **TypeScript**: Full type safety maintained
7. **React Context Access**: Interceptors can access React hooks and context
8. **Anonymous by Default**: Actors are initialized immediately with anonymous agent, allowing unauthenticated calls
9. **Separate Concerns**: Authentication and interceptor setup are independent operations

## Troubleshooting

### Identity Not Persisting

The new API initializes actors automatically with an anonymous agent. To authenticate with an identity, use the `authenticate()` method:

```tsx
useEffect(() => {
  if (identity) {
    authenticate(identity);
  }
}, [identity, authenticate]);
```

### Multiple Actors Not Working

Each actor hook created with `createActorHook()` maintains its own independent state. Make sure you're authenticating each one separately:

```tsx
const { authenticate: authBackend } = useBackendActor();
const { authenticate: authNFT } = useNFTActor();

useEffect(() => {
  if (identity) {
    authBackend(identity);
    authNFT(identity);
  }
}, [identity, authBackend, authNFT]);
```

## Need Help?

If you encounter any issues during migration, please [open an issue](https://github.com/kristoferlund/ic-use-actor/issues) on GitHub.
