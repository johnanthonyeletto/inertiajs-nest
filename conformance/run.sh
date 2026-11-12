#!/usr/bin/env bash
#
# Inertia.js v3 conformance run for inertia-nest.
#
# Clones inertiajs/inertia at a pinned release and runs its Playwright suite
# unmodified. A Node preload (conformance/preload.cjs) redirects the test
# server's `require('./helpers')` to conformance/helpers.cjs, a transport port
# backed by inertia-nest, so not one byte of the upstream checkout changes.
# See conformance/README.md.
#
# Usage:  conformance/run.sh [react|vue3|svelte] [extra playwright args...]
#           e.g. conformance/run.sh react tests/partial-reloads.spec.ts
# Env:    INERTIA_REF               upstream tag/commit/branch (default: pinned release)
#         CONFORMANCE_BASELINE=1    run WITHOUT the preload, i.e. against upstream's own
#                                   helpers.js (triage: separates flakes from adapter issues)
#         CONFORMANCE_NO_EXCLUSIONS=1
#                                   also run the KNOWN_DEVIATIONS tests listed below
set -euo pipefail

PKG="${1:-react}"
shift || true
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT/conformance"
INERTIA="$CONF/inertia"

case "$PKG" in
  react) PORT=13716 ;;
  vue3) PORT=13715 ;;
  svelte) PORT=13717 ;;
  *) echo "!! unknown framework '$PKG' (expected react, vue3 or svelte)" >&2; exit 2 ;;
esac

# Pinned to an upstream RELEASE so the result names the client version users
# install. Tags are mutable, commits are not: the tag's commit is asserted after
# fetch. Bump both together. INERTIA_REF overrides (sha assert skipped).
INERTIA_TAG="v3.11.0"
INERTIA_TAG_SHA="f3125577a9e5a5a8bcdecffefc2e6577282f7868"
INERTIA_REF="${INERTIA_REF:-$INERTIA_TAG}"
EXPECT_SHA=""
[ "$INERTIA_REF" = "$INERTIA_TAG" ] && EXPECT_SHA="$INERTIA_TAG_SHA"

# Known deviations: upstream tests that encode a behaviour of the reference
# server (tests/app/helpers.js) that inertia-nest deliberately does not share.
# Every one passes against upstream's own helpers.js (CONFORMANCE_BASELINE=1).
# See "Known deviations" in conformance/README.md for the reasoning.
#
# Format: exact `--list` title path, "<spec file> › <describe…> › <test title>".
# Each entry becomes an anchored, fully escaped regex, and the run aborts unless
# the combined pattern matches exactly as many tests as there are entries, so
# the list can't silently exclude anything else (or go stale on an upstream bump).
# CONFORMANCE_NO_EXCLUSIONS=1 runs them anyway.
KNOWN_DEVIATIONS=(
  # 1. Closure arguments: the /links/partial-reloads and /visits/partial-reloads
  #    routes define `bar: (props) => props.foo + 1`. The reference server calls
  #    closures as fn(data.props); inertia-nest (like inertia-laravel) calls them
  #    with no arguments, so these routes throw and the page 500s.
  'links.spec.ts › partial reloads › does not have headers specific to partial reloads when the feature is not being used'
  'links.spec.ts › partial reloads › has headers specific to partial reloads'
  'links.spec.ts › partial reloads › it updates all props when the feature is not being used'
  'links.spec.ts › partial reloads › it only updates props that are passed through "only"'
  'links.spec.ts › partial reloads › it only updates props that are not passed through "except"'
  'manual-visits.spec.ts › Partial Reloads › does not have headers specific to partial reloads when the feature is not being used visit'
  'manual-visits.spec.ts › Partial Reloads › has headers specific to "only" partial reloads (visit)'
  'manual-visits.spec.ts › Partial Reloads › has headers specific to "except" partial reloads (visit)'
  'manual-visits.spec.ts › Partial Reloads › it updates all props when the feature is not being used (visit)'
  'manual-visits.spec.ts › Partial Reloads › it only updates props that are passed through "only" (visit)'
  'manual-visits.spec.ts › Partial Reloads › it only updates props that are not passed through "except" (visit)'
  'manual-visits.spec.ts › Partial Reloads › does not have headers specific to partial reloads when the feature is not being used GET'
  'manual-visits.spec.ts › Partial Reloads › has headers specific to "only" partial reloads (GET)'
  'manual-visits.spec.ts › Partial Reloads › has headers specific to "except" partial reloads (GET)'
  'manual-visits.spec.ts › Partial Reloads › it updates all props when the feature is not being used (GET)'
  'manual-visits.spec.ts › Partial Reloads › it only updates props that are passed through "only" (GET)'
  'manual-visits.spec.ts › Partial Reloads › it only updates props that are not passed through "except" (GET)'
  # 2. Nested except: `except: ['auth.notifications']`. The reference server
  #    drops the whole top-level `auth` key; inertia-nest (like inertia-laravel)
  #    drops only the `auth.notifications` child and sends the rest of `auth`.
  'nested-props.spec.ts › it preserves rescued child props when that child path is excluded from reload'
)

# Runner timing (not deviations): upstream tests that fail just as often
# against upstream's own helpers.js on GitHub's ubuntu runners, so they say
# nothing about the adapter. Applied only on CI, only for the listed framework.
# Evidence: CONFORMANCE_BASELINE=1 vs adapter, --repeat-each=10, vue3: 9/10
# failed in both (actions runs 43123587333 and 43123596569). Locally both pass.
CI_TIMING_EXCLUSIONS_VUE3=(
  # 10 navigations under a 10 s test timeout; too slow on the runner for vue3.
  'links.spec.ts › scroll › scrolls to top after the page has been rendered'
)

EXCLUSIONS=("${KNOWN_DEVIATIONS[@]}")
if [ -n "${CI:-}" ] && [ "$PKG" = vue3 ]; then
  EXCLUSIONS+=("${CI_TIMING_EXCLUSIONS_VUE3[@]}")
fi

# Upstream requires pnpm >= 11.1.1 (package.json engines). Playwright's web
# server command calls `pnpm` itself, so it must be on PATH: use the local one if
# it is new enough (this repo pins pnpm 11.5.3 in packageManager), otherwise put an
# npx-backed shim first on PATH.
PNPM_MIN="11.1.1"
PNPM_VERSION="11.5.3"
pnpm_ok() {
  command -v pnpm >/dev/null 2>&1 || return 1
  node -e 'const v=(s)=>s.split(".").map(Number); const [a,b]=[v(process.argv[1]),v(process.argv[2])];
    for (let i=0;i<3;i++){ if(a[i]!==b[i]) process.exit(a[i]>b[i]?0:1) } process.exit(0)' \
    "$(pnpm -v 2>/dev/null | cut -d- -f1)" "$PNPM_MIN"
}
if ! pnpm_ok; then
  SHIM_DIR="$(mktemp -d)"
  printf '#!/usr/bin/env bash\nexec npx --yes "pnpm@%s" "$@"\n' "$PNPM_VERSION" > "$SHIM_DIR/pnpm"
  chmod +x "$SHIM_DIR/pnpm"
  export PATH="$SHIM_DIR:$PATH"
  echo "==> Using pnpm@$PNPM_VERSION via npx"
fi

# require(esm) (used by helpers.cjs to load the ESM-only package) needs Node >= 22.12.
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)' \
  || { echo "!! Node >= 22.12 required (found $(node -v))" >&2; exit 1; }

# 1. Build the adapter. helpers.cjs loads its dist, so a stale build would
#    silently test old code.
echo "==> Building inertia-nest"
[ -e "$ROOT/node_modules/inertia-nest" ] || { echo "!! run 'pnpm install' at the repo root first" >&2; exit 1; }
( cd "$ROOT" && pnpm --filter inertia-nest build )

# 2. Put the upstream checkout at the wanted ref (shallow, exact commit).
if [ ! -d "$INERTIA/.git" ]; then
  rm -rf "$INERTIA"
  mkdir -p "$INERTIA"
  git -C "$INERTIA" init -q
  git -C "$INERTIA" remote add origin https://github.com/inertiajs/inertia.git
fi
if [ -z "$EXPECT_SHA" ] || [ "$(git -C "$INERTIA" rev-parse HEAD 2>/dev/null || true)" != "$EXPECT_SHA" ]; then
  echo "==> Fetching inertiajs/inertia @ $INERTIA_REF"
  git -C "$INERTIA" fetch --depth 1 -q origin "$INERTIA_REF"
  git -C "$INERTIA" checkout -q --force FETCH_HEAD
fi
SHA="$(git -C "$INERTIA" rev-parse HEAD)"
if [ -n "$EXPECT_SHA" ] && [ "$SHA" != "$EXPECT_SHA" ]; then
  echo "!! $INERTIA_REF resolved to $SHA, expected $EXPECT_SHA (tag moved?)" >&2
  exit 1
fi

# 3. Install + build the upstream monorepo and the framework test-app.
echo "==> Installing + building upstream ($PKG)"
( cd "$INERTIA" && pnpm install && pnpm build:all )
( cd "$INERTIA" && pnpm -r --filter "./packages/$PKG/test-app" build )

# 4. The upstream checkout must be pristine (tracked and untracked files; only
#    pnpm-lock.yaml may be touched by the install).
assert_pristine() {
  local dirty
  dirty="$(git -C "$INERTIA" status --porcelain --untracked-files=all | grep -v ' pnpm-lock.yaml$' || true)"
  if [ -n "$dirty" ]; then
    echo "!! upstream checkout is modified; refusing to make a conformance claim against it:" >&2
    echo "$dirty" >&2
    exit 1
  fi
}
assert_pristine

# 5. Playwright reuses an already-running server on the test port (outside CI),
#    which would silently bypass the preload. Refuse instead.
if node -e "require('net').connect($PORT,'localhost').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"; then
  echo "!! port $PORT is already in use; Playwright would reuse that server instead of starting a swapped one" >&2
  exit 1
fi

# 6. Browser binary (+ OS deps on CI) and run.
if [ -n "${CI:-}" ]; then
  ( cd "$INERTIA" && npx playwright install --with-deps chromium )
else
  ( cd "$INERTIA" && npx playwright install chromium )
fi

PRELOAD_OPTS="--require $CONF/preload.cjs"
MODE="inertia-nest (helpers swapped)"
if [ -n "${CONFORMANCE_BASELINE:-}" ]; then
  PRELOAD_OPTS=""
  MODE="BASELINE: upstream helpers.js, adapter NOT in the loop"
fi

# Known deviations -> one --grep-invert pattern. Playwright greps against
# "<project> <file> <describe…> <title>"; each entry is anchored at the end and
# on a word boundary at the start, with every segment regex-escaped.
EXCLUDE_ARGS=()
if [ -n "${CONFORMANCE_BASELINE:-}" ] || [ -n "${CONFORMANCE_NO_EXCLUSIONS:-}" ]; then
  echo "==> Exclusions: NOT applied (${#EXCLUSIONS[@]} listed; all tests run)"
else
  PATTERN="$(node -e '
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const entries = process.argv.slice(1)
    process.stdout.write(entries.map((e) => "(?:^|\\s)" + e.split(" › ").map(escape).join(" ") + "$").join("|"))
  ' "${EXCLUSIONS[@]}")"
  MATCHED="$(cd "$INERTIA" && PACKAGE="$PKG" npx playwright test --project chromium --list --grep "$PATTERN" 2>/dev/null \
    | grep -E '^ +\[chromium\] › ' || true)"
  MATCHED_COUNT="$(printf '%s' "$MATCHED" | grep -c . || true)"
  echo "==> Excluding ${#EXCLUSIONS[@]} tests: ${#KNOWN_DEVIATIONS[@]} known deviations + $(( ${#EXCLUSIONS[@]} - ${#KNOWN_DEVIATIONS[@]} )) runner-timing (see conformance/README.md):"
  printf '%s\n' "$MATCHED" | sed 's/^ */    /'
  if [ "$MATCHED_COUNT" -ne "${#EXCLUSIONS[@]}" ]; then
    echo "!! the exclusion pattern matches $MATCHED_COUNT tests, expected exactly ${#EXCLUSIONS[@]};" \
      "update KNOWN_DEVIATIONS / CI_TIMING_EXCLUSIONS_VUE3 in conformance/run.sh (or run with CONFORMANCE_NO_EXCLUSIONS=1)" >&2
    exit 1
  fi
  echo "    excluded: $MATCHED_COUNT tests"
  EXCLUDE_ARGS=(--grep-invert "$PATTERN")
fi

LOG="$(mktemp "${TMPDIR:-/tmp}/inertia-nest-conformance.XXXXXX")"
echo "==> Running conformance suite: $PKG, inertiajs/inertia $INERTIA_REF ($SHA), $MODE"
echo "    log: $LOG"
# NODE_OPTIONS flows playwright -> pnpm serve -> node server.js, where the
# preload swaps helpers. In the runner, worker, pnpm and Vite processes it is a no-op.
set +e
( cd "$INERTIA" && PACKAGE="$PKG" NODE_OPTIONS="${NODE_OPTIONS:-} $PRELOAD_OPTS" \
    node playwright.js --reporter=line --retries=2 ${EXCLUDE_ARGS[@]+"${EXCLUDE_ARGS[@]}"} "$@" ) 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[0]}
set -e

# 7. A green run only means something if the adapter was in the loop.
if [ -z "${CONFORMANCE_BASELINE:-}" ] && ! grep -q '\[conformance\] helpers swapped' "$LOG"; then
  echo "!! swap marker missing from the output: the test server did not load conformance/helpers.cjs" >&2
  STATUS=1
fi
assert_pristine

exit "$STATUS"
