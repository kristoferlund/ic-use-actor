# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 0.3.1 - 2025-10-01

### Changed

- Upgraded `@dfinity/xxx` dependencies to `v3.2.7` 

## [0.3.0] - 2025-09-15

### General

- v0.3.0 focuses on smoother app integration and orchestration across multiple canisters. It adds non-React helpers and global utilities so you can gate routes, authenticate many actors at once, and reliably check initialization/auth state without wiring extra context or providers. Docs now include a router-first flow.

### Key Features
- Unified runtime status: New `status` plus `isInitializing/isSuccess/isError`.
- Non-React helpers: Call `ensureInitialized`, `authenticate`, `getActor`, and status predicates outside components.
- Global orchestration: `ensureAllInitialized`, `authenticateAll`, and `authenticateCanister` coordinate many hooks.
- Router integration docs: Example guard flow with TanStack Router for predictable startup and auth, no `useEffect` in sight.

Example (route guard flow):
```ts
const identity = await ensureIdentityInitialized(); // from ic-use-internet-identity
if (!identity) throw redirect({ to: "/login" });

await ensureAllInitialized();     // wait for all actor hooks to finish anonymous init
await authenticateAll(identity);  // attach identity to all registered hooks
```

### Added
- Status + flags: `status: "initializing" | "success" | "error"` and derived booleans.
- Per-hook helpers (non-React): `useMyActor.ensureInitialized()`, `useMyActor.authenticate(identity)`, `useMyActor.getActor()`, `useMyActor.isAuthenticated()` and predicates for status.
- Global helpers: `ensureAllInitialized()`, `authenticateAll(identity, filter?)`, `authenticateCanister(identity, canisterId)`.
- Router example: End-to-end “beforeLoad” example covering identity restore → actor init → authentication

### Fixed
- Docs clarity: Clear separation of initialization vs. authentication; `error` now documented as “initialization only”.
- Interceptor ergonomics: Example shows handling “delegation expired” with app hooks, without polluting init error state.
- Minor typos and examples: Cleaned and tightened API examples, consistent naming.

### Migration
- From v0.2.x → v0.3.0: No breaking changes. You can adopt:
  - `status` and the derived flags for simpler UI state.
  - Non-React helpers in guards, loaders, or services.
  - Global helpers to authentically attach identity across many hooks at once.

### Important Notes
- Initialization vs auth: `isSuccess` means “actor created”; it does NOT imply authenticated. Check `isAuthenticated`.
- Identity first: Always await your identity library’s init before initializing/authenticating actors in guards.
- Auth is local: `authenticate(identity)` mutates the agent’s identity; it doesn’t perform a network request.
- Multiple canisters: Either authenticate each hook or use `authenticateAll(identity)`; you can filter by canister id.
- Errors: The exposed `error` is reserved for initialization failures; interceptor/auth errors won’t set it.


## [0.2.0] - 2025-08-06

### Added

- New simplified API using XState stores for state management
- `createActorHook` function for creating typed actor hooks without React Context
- Actors are now initialized immediately with an anonymous agent, allowing unauthenticated calls
- `authenticate` method to authenticate an existing actor with an identity
- `setInterceptors` method to configure request/response interceptors separately from authentication
- `isAuthenticated` flag to track authentication status
- Migration guide for upgrading from v0.1.x

### Changed

- **BREAKING**: Complete API redesign - replaced React Context pattern with XState stores
- **BREAKING**: Upgraded minimum required versions of @dfinity/xxx dependencies to >=v3.1.0 ([1aa0f44](https://github.com/kristoferlund/ic-use-actor/commit/1aa0f44637e2f2fde54ce97087c2af019f1892d2))
- **BREAKING**: Interceptors are now set via `setInterceptors()` method instead of during initialization
- No longer requires Provider components or React Context
- Actor state is now managed globally via XState stores
- Simplified setup - one function call per canister instead of context + hook + provider
- Actors are created immediately on store creation with anonymous agent
- Authentication and interceptor setup are now separate concerns

### Removed

- **BREAKING**: Removed `createActorContext` (no longer needed)
- **BREAKING**: Removed `createUseActorHook` (replaced by `createActorHook`)
- **BREAKING**: Removed `ActorProvider` component (no longer needed)
- **BREAKING**: Removed custom error handling utilities `AgentHTTPResponseError`, `isAgentHTTPResponseError`, and `isIdentityExpiredError` ([3ba110e](https://github.com/kristoferlund/ic-use-actor/commit/3ba110e717254b188785a1e90db89d7428486553))

### Dependencies

- Added `@xstate/store` as a peer dependency (>=2.0.0)

## 0.1.0 - 2024-10-16

### Changed

- Upgraded minimum required versions of @dfinity/xxx dependencies to >=v2.1.2

## [0.0.10] - 2024-07-11

### Changed

- Upgraded minimum required versions of @dfinity/xxx dependencies

## [0.0.9] - 2024-03-07

### Changed

- Moved @dfinity/xxx dependencies from dependencies to peerDependencies to reduce package size.

## Fixed

- Don't allow the actor context to be undefined as this can lead to unpredictable behaviour.

## [0.0.8] - 2024-03-04

### Changed

- Upgraded @dfinity/xxx dependencies to latest versions.

## [0.0.7] - 2024-01-31

No changes. Upgrader to sync version numbers with [ic-use-siwe-identity](https://github.com/kristoferlund/ic-siwe/tree/main/packages/ic-use-siwe-identity).

## [0.0.5] - 2024-01-18

### Changed

- Moved @dfinity/xxx dependencies from peerDependencies to dependencies because of bundling issues. This grows package size but prevents bundling issues in consuming apps.
- Minor refactoring.

## [0.0.4] - 2024-01-18

### Added

- `isAgentHTTPResponseError` - Type guard that returns true if the error is an instance of the AgentHTTPResponseError class.
- `isIdentityExpiredError` - Helper function to check if an error is an expired identity error. Returns true if the users identity has expired. The user will need to sign in again to get a new identity.

## [0.0.3] - 2024-01-15

### Changed

- Re-export types for nicer looking imports in consuming apps.
- Minify the bundle.

## [0.0.2] - 2024-01-08

### Fixed

- Fixed an issue with the NPM release workflow.

## [0.0.1] - 2024-01-08

### Added

- First release. `ic-use-actor` v0.0.1 should be regarded as alpha software.
