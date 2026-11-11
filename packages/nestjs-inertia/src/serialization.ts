import type { Page } from './types.js'

/**
 * Serialize a page object to JSON.
 *
 * `bigint` values can't be represented in JSON. With `preserveBigIntegers`,
 * the protocol's big integer convention applies: values outside JavaScript's
 * safe integer range become `{"$bigint": "<digits>"}` markers (which the
 * client revives as `BigInt`s) and safe ones become plain numbers. Without
 * it, `bigint`s are rejected, as `JSON.stringify` would.
 *
 * The replacer sees values after `toJSON()`, so models and other classes
 * that serialize themselves are covered too.
 */
export function serializePage(page: Page): string {
  return JSON.stringify(page, page.preserveBigIntegers ? encodeBigInt : undefined)
}

/**
 * Serialize the page object for a `<script type="application/json">` tag.
 * Escaping `/` keeps `</script>` sequences inside props from closing the tag
 * early (as the protocol requires); `<`, `>` and the line separators are
 * escaped as well for good measure. HTML entities must not be used here.
 */
export function encodePageForScript(page: Page): string {
  return serializePage(page)
    .replace(/\//g, '\\/')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replaceAll(String.fromCharCode(0x2028), '\\u2028')
    .replaceAll(String.fromCharCode(0x2029), '\\u2029')
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER)

/** `JSON.stringify` replacer implementing the protocol's big integer markers. */
export function encodeBigInt(_key: string, value: unknown): unknown {
  if (typeof value !== 'bigint') {
    return value
  }

  return value > MAX_SAFE || value < MIN_SAFE ? { $bigint: value.toString() } : Number(value)
}

/** `JSON.parse` reviver turning big integer markers back into `bigint`s (used by the testing helpers). */
export function reviveBigInt(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as { $bigint?: unknown }).$bigint === 'string'
  ) {
    return BigInt((value as { $bigint: string }).$bigint)
  }

  return value
}
