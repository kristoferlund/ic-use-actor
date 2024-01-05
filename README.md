# ic-use-actor

A React context provider for managing Internet Computer (IC) actors with enhanced features like type safety and middleware support.

**GPT-4 generated description below, not 100%, to be edited.**

## Features

- **Type Safety**: Ensures that the actors conform to the service definitions, providing strong typing benefits.
- **Shared Actor Context**: Utilizes React context to share the same actor across multiple components, allowing for efficient reuse in numerous calls.
- **Middleware Support**: Offers `onRequest`, `onResponse`, `onRequestError`, and `onResponseError` middleware for intercepting and processing requests and responses.

## Usage

To use `ic-use-actor` in your React application, follow these steps:

### Setting Up the Actor Context and Hook

First, create an actor context and a corresponding hook for your IC service:

```jsx
import {
  createActorContext,
  createUseActorHook,
} from "ic-use-actor";
import { _SERVICE } from "path-to/your-service.did";

export const actorContext = createActorContext<_SERVICE>();
export const useActor = createUseActorHook<_SERVICE>(actorContext);
```

### Using ActorProvider to Wrap Your App

Wrap your application's root component with ActorProvider and pass in the necessary props:

```jsx
import { ActorProvider } from "ic-use-actor";
import { idlFactory, canisterId } from "path-to/your-service";
import { useSiweIdentity } from "ic-use-siwe-identity";

function App({ children }) {
  const { identity } = useSiweIdentity();

  return (
    <ActorProvider
      canisterId={canisterId}
      context={actorContext}
      identity={identity}
      idlFactory={idlFactory}
      // Optional middleware callbacks
      onRequestError={errorHandler}
      onResponseError={responseErrorHandler}
    >
      {children}
    </ActorProvider>
  );
}
```

### Accessing the Actor in Components

In your components, use the useActor hook to access the actor:

```jsx
import { useActor } from "path-to/useActor";

function MyComponent() {
  const { actor } = useActor();

  // Use the actor for calling methods on your canister
}
```

### Contributing

Contributions are welcome. Please submit your pull requests or open issues to propose changes or report bugs.

### License

This project is licensed under the MIT License. See the LICENSE file for more details.
