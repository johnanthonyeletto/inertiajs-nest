/**
 * Node preload (`NODE_OPTIONS=--require`) for the conformance run.
 *
 * Redirects the upstream test server's `require('./helpers')` to
 * conformance/helpers.cjs, the transport port backed by `inertia-nest`, without
 * modifying a single file in the inertiajs/inertia checkout. Every other module
 * resolves normally, so in the Playwright runner, pnpm and Vite processes (which
 * also inherit NODE_OPTIONS) this hook is a no-op.
 */
const Module = require('module')
const fs = require('fs')
const path = require('path')

const realpath = (file) => {
  try {
    return fs.realpathSync(file)
  } catch {
    return file
  }
}

// Node resolves symlinks before returning a filename, so compare real paths.
const UPSTREAM_HELPERS = realpath(path.resolve(__dirname, 'inertia/tests/app/helpers.js'))
const PORTED_HELPERS = path.resolve(__dirname, 'helpers.cjs')

const originalResolveFilename = Module._resolveFilename

/**
 * Swap the resolved path when (and only when) it lands on upstream helpers.js.
 * @param {string} request module specifier as written in the requiring file
 * @param {...unknown} rest parent module, isMain, options (passed through untouched)
 * @returns {string} resolved filename
 */
Module._resolveFilename = function resolveFilenameWithHelpersSwap(request, ...rest) {
  const resolved = originalResolveFilename.call(this, request, ...rest)
  return resolved === UPSTREAM_HELPERS ? PORTED_HELPERS : resolved
}
