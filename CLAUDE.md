# CLAUDE.md

pnpm workspace: the published adapter is `packages/nestjs-inertia` (npm: `@johnanthonyeletto/nestjs-inertia`), the demo app is `apps/demo`, and `conformance/` runs the official Inertia Playwright suite against the adapter.

## Checks

- `pnpm typecheck`, `pnpm test`, `pnpm pack:check`
- Demo browser suite: `pnpm test:browser` (needs the demo running; see the root README)

## Versioning and releases

See `docs/distribution-plan.md`.

- Any PR that changes `packages/nestjs-inertia/src`, `bin`, `stubs`, or its `package.json` must bump `version` in `packages/nestjs-inertia/package.json`, unless the version is already ahead of the latest `v*` git tag. CI (`.github/workflows/version-check.yml`) enforces this. Use the `no release` PR label only for changes that don't affect what ships (e.g. a devDependency bump).
- While on `0.x`: bump the minor for breaking changes or notable features, the patch otherwise. Don't try to match Inertia's version numbers; at `3.0.0` the major will track the Inertia major.
- Releasing: after merging, `gh release create vX.Y.Z --target master --generate-notes`. `.github/workflows/release.yml` publishes to npm.
