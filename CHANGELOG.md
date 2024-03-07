# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
