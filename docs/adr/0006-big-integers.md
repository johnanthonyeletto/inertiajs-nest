# 0006. Encode `bigint`s with a JSON replacer

Status: Accepted (2026-11-11)

## Context

Inertia 3.8 added `preserveBigIntegers`: integers outside JavaScript's safe range travel as `{"$bigint": "<digits>"}` markers, which the client revives as `BigInt`. In Node, such values are `bigint`s, which `JSON.stringify` rejects.

## Decision

- Page serialization (JSON responses, the `data-page` script, and SSR requests) goes through `serializePage()`. With the feature enabled, it uses a replacer that turns unsafe `bigint`s into markers and safe ones into numbers. The replacer runs after `toJSON()`, so models and other classes that serialize themselves are covered too.
- The feature is off by default, as in Laravel. Turn it on with `preserveBigIntegers: true` in the config, or per response with `.preserveBigIntegers()`. The page then carries `preserveBigIntegers: true`.
- The testing helpers revive markers, so assertions can compare against `bigint`s.

## Consequences

- With the feature off, a `bigint` prop fails serialization exactly as `JSON.stringify` would, instead of silently losing precision.
