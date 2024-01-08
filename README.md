# ic-use-actor

A React context provider for managing Internet Computer (IC) actors with enhanced features like type safety and request/response interceptors. `ic-use-actor` makes interacting with Internet Computer canisters more fun!

![npm](https://img.shields.io/npm/v/ic-use-actor)
![npm](https://img.shields.io/npm/dw/ic-use-actor)

## Features

- **Shared Actor Context**: Allows the same actor to be used across multiple components.
- **Typescript Support**: Makes full use of the canister service definitions to provide type safety for requests and responses.
- **Interceptors**: `onRequest`, `onResponse`, `onRequestError`, and `onResponseError` callbacks allow for intercepting and processing requests and responses.

## Pre-requisites

`ic-use-actor` needs an Internet Computer (IC) identity to work. The examples below uses `ic-use-siwe-identity` as an identity provider. You can use any other identity provider as long as it returns a valid IC identity.

## Installation

In addition to `ic-use-actor`, the following packages are required:

- `@dfinity/agent`
- `@dfinity/identity`
- `@dfinity/candid`

```bash
npm install ic-use-actor @dfinity/agent @dfinity/identity @dfinity/candid
```

## Usage

To use `ic-use-actor` in your React application, follow these steps:

### 1. Setting Up the Actor Context and Hook

First, create an actor context and a corresponding hook for each IC canister you would like to access. Export the hook to be able to use it in your components. The hook returned by `createUseActorHook` can be named anything you want. If using `ic-use-actor` with multiple canisters, you might want to name the hook after the canister to make it easier to identify which hook is for which canister - for example, `useMyCanister`, `useMyOtherCanister`, etc.

```jsx
import {
  createActorContext,
  createUseActorHook,
} from "ic-use-actor";
import { _SERVICE } from "path-to/your-service.did";

const actorContext = createActorContext<_SERVICE>();
export const useActor = createUseActorHook<_SERVICE>(actorContext);
```

### 2. Creating an Actor Provider Component

Create one or more ActorProvider components to provide access to your canisters. ActorProviders can be nested to provide access to multiple canisters.

```jsx
// Actors.tsx

import { ReactNode } from "react";
import {
  ActorProvider,
  createActorContext,
  createUseActorHook,
} from "ic-use-actor";
import {
  canisterId,
  idlFactory,
} from "path-to/your-service/index";
import { _SERVICE } from "path-to/your-service.did";
import { useSiweIdentity } from "ic-use-siwe-identity";

const actorContext = createActorContext<_SERVICE>();
export const useActor = createUseActorHook<_SERVICE>(actorContext);

export default function Actors({ children }: { children: ReactNode }) {
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
```

### 3. Wrapping Your Application

Wrap your application root component with the ActorProvider component(s) you created in the previous step to provide access to your canisters.

```jsx
// App.tsx

import Actors from "./Actors";

function App() {
  return (
    <Actors>
      <MyApplication />
    </Actors>
  );
}
```

### 4. Accessing the Actor in Components

In your components, use the useActor hook to access the actor:

```jsx
// AnyComponent.tsx

import { useActor } from "path-to/useActor";

function AnyComponent() {
  const { actor } = useActor();

  // Use the actor for calling methods on your canister
  React.useEffect(() => {
    actor
      .my_method()
      .then((result) => {
        // Do something with the result
      })
      .catch((error) => {
        // Handle the error
      });
  }, []);
}
```

## Advanced Usage

### Setting up interceptors

Interceptors can be used to intercept requests and responses. You can use them to modify requests, log requests and responses, or perform other actions.

```jsx
export default function Actor({ children }: { children: ReactNode }) {
  const { identity } = useSiweIdentity();

  const handleRequest = (data: InterceptorRequestData) => {
    // Do something
    // data: { args: unknown[], methodName: string }
    return data.args;
  };

  const handleResponse = (data: InterceptorResponseData) => {
    // Do something
    // data: { args: unknown[], methodName: string, response: unknown }
    return data.response;
  };

  const handleError = (data: InterceptorErrorData) => {
    // Do something
    // data: { args: unknown[], methodName: string, error: unknown }
    return data.error;
  };

  return (
    <ActorProvider<_SERVICE>
      canisterId={canisterId}
      context={actorContext}
      identity={identity}
      idlFactory={idlFactory}
      onRequest={handleRequest}
      onRequestError={handleError}
      onResponse={handleResponse}
      onResponseError={handleError}
    >
      {children}
    </ActorProvider>
  );
}
```

## Contributing

Contributions are welcome. Please submit your pull requests or open issues to propose changes or report bugs.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
