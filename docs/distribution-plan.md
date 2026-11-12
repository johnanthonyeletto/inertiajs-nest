# Distribution plan

Status: proposed · 2026-11-11

This plan settles Decisions 2 and 3 in [packaging-plan.md](packaging-plan.md) and replaces the publishing part of its Phase 4. The package is mostly for personal use, so the plan takes the simplest route at each step. It leaves out changesets, a changelog file, release bots, and the inertiajs.com listing (Phase 5).

## Decisions

| Question | Answer | Why |
|---|---|---|
| Name | `@johnanthonyeletto/nestjs-inertia` | Matches the package directory and the `nestjs-inertia` CLI binary. Scoped names under your npm username are free and can't collide. |
| Registry | Public npm (npmjs.com) | GitHub Packages' npm registry needs an auth token to install even public packages, so every consuming project would need an `.npmrc` and a PAT. npm needs nothing. |
| Publishing | GitHub Actions with npm **trusted publishing** (OIDC) | No `NPM_TOKEN` secret to create or rotate. Provenance is attached automatically. |
| Release trigger | Publishing a GitHub Release (`v0.1.0`, ...) | Built into GitHub. `--generate-notes` writes the release notes from merged PRs, so there's no changelog to maintain. |
| Versioning | Manual bump in `packages/nestjs-inertia/package.json`, `0.x` for now (see [Versioning](#versioning)), enforced by a CI check | Only one package is published, so a tool isn't worth it. |
| Repo visibility | Public | Free Actions minutes, and provenance links to a visible source. |

## Versioning

**Now: `0.x`.** The API is still settling, and in `0.x` semver allows breaking changes. Bump the minor (`0.1.0` → `0.2.0`) for a breaking change or a notable feature, and the patch (`0.1.0` → `0.1.1`) for fixes and small additions. The README states compatibility as "Inertia v3, tested against 3.11". The conformance workflow's pinned upstream tag backs that up. The package has no runtime dependency on `@inertiajs/*`, so a peer dependency can't express it.

**Once the API settles: `3.0.0`, then major = Inertia major.** This follows the reference adapter: `inertia-laravel` 3.x and the Phoenix adapter 3.x both support Inertia v3. Skipping 1.x and 2.x is harmless, and it makes the supported Inertia version obvious from the version number. After that:
- minors and patches carry adapter features and fixes, including support for new Inertia v3 features such as live props;
- breaking changes to this package's own API wait for Inertia v4 and ship as `4.0.0`.

**Never match Inertia's minors.** No official adapter does: Rails and Django version independently, and Laravel and Phoenix match only the major. Inertia ships a minor about every month, and the adapter needs releases of its own between them.

**The fallback**, if aligning majors ever becomes a burden, is independent versioning like Rails and Django (`1.0.0` next), with a version-to-Inertia table in the README.

## Never forgetting the version bump

Three layers, from strongest to most convenient:

1. **A required CI check** (`.github/workflows/version-check.yml`, below). It fails a PR when files that ship in the package have changed since the last release tag but the version still equals that tag.
   - Comparing against the last *tag* rather than the PR's base branch allows batching: the first PR after a release bumps to `0.1.1`, and later PRs pass without another bump until `v0.1.1` is released.
   - "Files that ship" here means `src/`, `bin/`, `stubs/`, and `package.json`. Tests, configs, the demo, docs, and conformance changes never trigger the check.
   - The escape hatch is a `no release` PR label, for example for a devDependency bump in `package.json`.
   - The check passes trivially before the first tag exists.
2. **The branch ruleset on `master`** (step 6) lists this check as required, so a PR can't be merged with it red.
3. **A `CLAUDE.md` at the repo root**, so Claude bumps the version in the same PR without being asked:

   ```md
   ## Releasing
   - Any PR that changes `packages/nestjs-inertia/src`, `bin`, `stubs`, or its `package.json`
     must bump `version` in `packages/nestjs-inertia/package.json`, unless the version is
     already ahead of the latest `v*` git tag. CI (`version-check.yml`) enforces this.
   - `0.x`: bump the minor for breaking changes or notable features, the patch otherwise.
   - Releases: `gh release create vX.Y.Z --target master --generate-notes` after merging.
   ```

The check lives in its own workflow, not `ci.yml`, because it has to re-run when a label is added or removed, and that shouldn't re-run the whole CI suite:

```yaml
name: Version check

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]

permissions:
  contents: read

jobs:
  version-bump:
    name: Version bump
    # Skipped jobs count as passing for required checks, so the label works as an override.
    if: ${{ !contains(github.event.pull_request.labels.*.name, 'no release') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0   # full history and tags
      - name: Shipped files changed since the last release need a new version
        run: |
          last=$(git describe --tags --abbrev=0 --match 'v*' "origin/${{ github.base_ref }}" 2>/dev/null) \
            || { echo "No release tag yet; nothing to check."; exit 0; }
          pkg=packages/nestjs-inertia
          changed=$(git diff --name-only "$last" HEAD -- "$pkg/src" "$pkg/bin" "$pkg/stubs" "$pkg/package.json")
          [ -n "$changed" ] || { echo "No shipped files changed since $last."; exit 0; }
          version="v$(node -p "require('./$pkg/package.json').version")"
          if [ "$version" = "$last" ]; then
            echo "::error::Shipped files changed since $last, but the version is still $version. Bump $pkg/package.json, or add the 'no release' label."
            echo "$changed"
            exit 1
          fi
          echo "OK: $last -> $version"
```

The other half, forgetting to *release* after merging, does no harm: the bump just sits on `master` until the next `gh release create`. If that ever becomes annoying, the release workflow could also run on pushes to `master` and publish whenever the version has no tag yet. That gives up batching, so it isn't part of this plan.

## Steps

### 1. Prepare the repo for going public

- Review what becomes visible. The history is 7 commits by one author, and no `.env`, key, or secret files are tracked. Run a scan anyway: `gitleaks git .` (or `brew install gitleaks` first).
- Add a root `LICENSE`. Only `packages/nestjs-inertia/LICENSE` exists today. Copy the MIT one so GitHub shows the license on the repo page.
- Optionally set a repo description and topics (`inertiajs`, `nestjs`).

### 2. Rename the package (one PR)

Replace `inertia-nest` with `@johnanthonyeletto/nestjs-inertia` across the repo. `git grep -l inertia-nest` lists about 45 files:

- **Manifests:** `packages/nestjs-inertia/package.json` (`name`), the root `package.json` (`devDependencies` and the `--filter` scripts), `apps/demo/package.json`, and `pnpm-lock.yaml` (regenerate with `pnpm install`).
- **CI:** `--filter inertia-nest` in `.github/workflows/ci.yml`.
- **Code a user sees:** the import printed by `src/cli/install.ts`, the `stubs/*.stub` files, JSDoc in `src/config.ts`, `src/types.ts`, and `src/testing/index.ts`.
- **Demo imports:** everything under `apps/demo/src`, plus `vite.config.ts`.
- **Conformance:** `conformance/helpers.cjs` (`require(...)`) and `conformance/run.sh`. Note that line 122 checks `node_modules/inertia-nest`, which becomes `node_modules/@johnanthonyeletto/nestjs-inertia`.
- **Docs:** both READMEs, `conformance/README.md`, and the ADRs. Mentions of the *project* in prose can stay as plain words. Only the package specifier has to change.

Then check that it worked: `pnpm typecheck && pnpm test && pnpm pack:check`, the demo browser suite, and `git grep inertia-nest` returning nothing (except deliberate history notes).

### 3. Make the package publishable

In `packages/nestjs-inertia/package.json`:

```jsonc
{
  "name": "@johnanthonyeletto/nestjs-inertia",
  "version": "0.1.0",
  // remove "private": true
  "author": "John Eletto",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/johnanthonyeletto/inertiajs-nest.git",
    "directory": "packages/nestjs-inertia"
  },
  "homepage": "https://github.com/johnanthonyeletto/inertiajs-nest/tree/master/packages/nestjs-inertia#readme",
  "bugs": "https://github.com/johnanthonyeletto/inertiajs-nest/issues",
  "publishConfig": { "access": "public", "provenance": true }
}
```

`repository.url` has to match the GitHub repo exactly, or npm rejects provenance and trusted publishing. Update the README's install line to `npm install @johnanthonyeletto/nestjs-inertia express-session`.

### 4. Add the release workflow

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write   # npm trusted publishing + provenance

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 24          # ships npm 11, which trusted publishing needs (>= 11.5.1)
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - name: Tag matches package version
        run: |
          v=$(node -p "require('./packages/nestjs-inertia/package.json').version")
          [ "v$v" = "${{ github.event.release.tag_name }}" ] || { echo "tag ${{ github.event.release.tag_name }} != v$v"; exit 1; }
      - run: pnpm --filter @johnanthonyeletto/nestjs-inertia typecheck
      - run: pnpm --filter @johnanthonyeletto/nestjs-inertia build
      - run: pnpm test
      - name: Publish
        working-directory: packages/nestjs-inertia
        run: |
          pnpm pack
          npm publish ./*.tgz --access public
```

`pnpm pack` then `npm publish` lets pnpm build the tarball and leaves the OIDC handshake to npm's CLI, which is the documented trusted-publishing path. Releases from a `-beta.N` tag can add `--tag next`. That isn't needed yet.

### 5. First publish, then switch to trusted publishing

npm attaches trusted-publisher settings to a package that already exists, so the very first version goes out by hand:

1. `npm login` (as `johnanthonyeletto`; `npm whoami` currently reports no login on this machine).
2. `pnpm --filter @johnanthonyeletto/nestjs-inertia build && cd packages/nestjs-inertia && npm publish --access public`. Provenance only works from CI, so it's skipped for this one version.
3. On npmjs.com → the package → **Settings → Trusted publishing**: GitHub Actions, owner `johnanthonyeletto`, repo `inertiajs-nest`, workflow `release.yml`.
4. Optional but recommended: in the same settings, choose **"Require two-factor authentication and disallow tokens"**, so only the workflow can publish.

Then tag that commit so the version check has a baseline: `git tag v0.1.0 <commit> && git push origin v0.1.0`. Use a plain tag, not a GitHub Release, because a Release would trigger `release.yml`, and its publish would fail on the version that already exists.

If npm then allows configuring trusted publishing for a package that doesn't exist yet, skip the manual publish and cut `v0.1.0` through step 6 instead.

### 6. Make the repository public

`gh repo edit johnanthonyeletto/inertiajs-nest --visibility public --accept-visibility-change-consequences`

Then, all built into GitHub and free for public repos:
- **Settings → Code security:** turn on secret scanning with push protection, and private vulnerability reporting.
- **Branch ruleset on `master`:** require a pull request and the status checks to pass before merging. At minimum require **Version bump**; the CI jobs are worth adding too. Leave yourself as a bypass actor if you want to be able to push small fixes directly.

### 7. Releasing from then on

```sh
# in a PR: bump packages/nestjs-inertia/package.json "version" to 0.1.1, merge
gh release create v0.1.1 --target master --generate-notes
```

The workflow checks that the tag matches the version, tests, builds, and publishes with provenance. Consumers run `pnpm add @johnanthonyeletto/nestjs-inertia`.

## Order of work

1. PR: rename + `package.json` metadata + root `LICENSE` + `release.yml` + `version-check.yml` + `CLAUDE.md` (steps 1–4 and [the version bump guard](#never-forgetting-the-version-bump)).
2. Merge, then make the repo public and add the branch ruleset (step 6). Do this before the first CI publish so provenance points at a public repo.
3. Manual `0.1.0` publish, the `v0.1.0` tag, and trusted-publisher setup (step 5).
4. Next release (`0.1.1`) is the first one through the workflow, which checks the pipeline end to end.

## Not doing (until there's a reason)

Changesets or release-please, a `CHANGELOG.md`, dual ESM/CJS builds, a `next` dist-tag channel, the inertiajs.com community-adapter listing, and Dependabot (it can be turned on in one click later).
