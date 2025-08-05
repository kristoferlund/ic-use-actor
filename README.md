# ic-use-actor

A React context provider for managing Internet Computer (IC) actors with enhanced features like type safety and request/response interceptors. `ic-use-actor` makes interacting with Internet Computer canisters more fun!

[![version][version-image]][npm-link]
[![downloads][dl-image]][npm-link]


## Features

- **Shared Actor Context**: Allows the same actor to be used across multiple components.
- **Typescript Support**: Makes full use of the canister service definitions to provide type safety for requests and responses.
- **Interceptors**: `onRequest`, `onResponse`, `onRequestError`, and `onResponseError` callbacks allow for intercepting and processing requests and responses.

## Table of Contents

- [ic-use-actor](#ic-use-actor)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Pre-requisites](#pre-requisites)
  - [Installation](#installation)
  - [Usage](#usage)
    - [1. Setting Up the Actor Context and Hook](#1-setting-up-the-actor-context-and-hook)
    - [2. Creating an Actor Provider Component](#2-creating-an-actor-provider-component)
    - [3. Wrapping Your Application](#3-wrapping-your-application)
    - [4. Accessing the Actor in Components](#4-accessing-the-actor-in-components)
  - [Advanced Usage](#advanced-usage)
    - [Setting up interceptors](#setting-up-interceptors)
  - [Error Handling](#error-handling)
  - [API Reference](#api-reference)
    - [Optional Props](#optional-props)
  - [Updates](#updates)
  - [Author](#author)
  - [Contributing](#contributing)
  - [License](#license)

## Pre-requisites

`ic-use-actor` needs an Internet Computer (IC) identity to work. The examples below uses `ic-use-siwe-identity` as an identity provider. You can use any other identity provider as long as it returns a valid IC identity.

## Installation

```bash
npm install ic-use-actor @dfinity/agent @dfinity/candid
```

## Usage

To use `ic-use-actor` in your React application, follow these steps:

### 1. Setting Up the Actor Context and Hook

First, create an actor context and a corresponding hook for each IC canister you would like to access. Export the hook to be able to use it in your components. The hook returned by `createUseActorHook` can be named anything you want. If using `ic-use-actor` with multiple canisters, you might want to name the hook after the canister to make it easier to identify which hook is for which canister - for example, `useMyCanister`, `useMyOtherCanister`, etc.

```tsx
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

```tsx
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

```tsx
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

```tsx
// AnyComponent.tsx

import React from "react";
import { useActor } from "path-to/useActor";

function AnyComponent() {
  const { actor } = useActor();

  // Use the actor for calling methods on your canister
  React.useEffect(() => {
    if (!actor) return;

    actor
      .my_method()
      .then((result) => {
        // Do something with the result
      })
      .catch((error) => {
        // Handle the error
      });
  }, [actor]);
}
```

## Advanced Usage

### Setting up interceptors

Interceptors can be used to intercept requests and responses. You can use them to modify requests, log requests and responses, or perform other actions.

```tsx
import { ReactNode } from "react";
import {
  ActorProvider,
  InterceptorRequestData,
  InterceptorResponseData,
  InterceptorErrorData,
} from "ic-use-actor";
import { _SERVICE } from "path-to/your-service.did";

export default function Actor({ children }: { children: ReactNode }) {
  const { identity } = useSiweIdentity();

  const handleRequest = (data: InterceptorRequestData) => {
    // Log or modify the request
    console.log(`Calling ${data.methodName} with args:`, data.args);
    // Must return the args array (potentially modified)
    return data.args;
  };

  const handleResponse = (data: InterceptorResponseData) => {
    // Log or modify the response
    console.log(`Response from ${data.methodName}:`, data.response);
    // Must return the response (potentially modified)
    return data.response;
  };

  const handleRequestError = (data: InterceptorErrorData) => {
    // Handle request errors (TypeError)
    console.error(`Request error in ${data.methodName}:`, data.error);
    // Must return the error (potentially modified)
    return data.error;
  };

  const handleResponseError = (data: InterceptorErrorData) => {
    // Handle response errors
    console.error(`Response error in ${data.methodName}:`, data.error);
    // Must return the error (potentially modified)
    return data.error;
  };

  return (
    <ActorProvider<_SERVICE>
      canisterId={canisterId}
      context={actorContext}
      identity={identity}
      idlFactory={idlFactory}
      onRequest={handleRequest}
      onRequestError={handleRequestError}
      onResponse={handleResponse}
      onResponseError={handleResponseError}
    >
      {children}
    </ActorProvider>
  );
}
```
## API Reference

### Optional Props

The `ActorProvider` component also accepts these optional props:

- `httpAgentOptions?: HttpAgentOptions` - Options for configuring the HTTP agent
- `actorOptions?: ActorConfig` - Configuration for customizing the Actor behavior

```tsx
<ActorProvider<_SERVICE>
  // ... required props
  httpAgentOptions={{
    host: "https://ic0.app",
    // other HttpAgent options
  }}
  actorOptions={{
    // Actor configuration options
  }}
>
  {children}
</ActorProvider>
```

## Updates

See the [CHANGELOG](CHANGELOG.md) for details on updates.

## Author

- [kristofer@kristoferlund.se](mailto:kristofer@kristoferlund.se)
- Twitter: [@kristoferlund](https://twitter.com/kristoferlund)
- Discord: kristoferkristofer
- Telegram: [@kristoferkristofer](https://t.me/kristoferkristofer)

## Contributing

Contributions are welcome. Please submit your pull requests or open issues to propose changes or report bugs.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.

[version-image]: https://img.shields.io/npm/v/ic-use-actor
[dl-image]: https://img.shields.io/npm/dw/ic-use-actor
[npm-link]: https://www.npmjs.com/package/ic-use-actor
