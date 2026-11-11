# 0005. Send responses without patching Nest internals

Status: Accepted (2026-11-11)

## Context

Handlers return `Responsable` values (pages, redirects, location visits) that write the response themselves. Nest then calls `httpAdapter.reply()` with the handler's (now empty) result. That reply sets the route's default status and calls `send()`, which fails once headers have been sent. The prototype monkey-patched `httpAdapter.reply` globally to skip responses that were already sent. The patch depended on a Nest internal and affected every response in the app.

## Decision

- After the interceptor writes a `Responsable`, it calls `markResponseHandled(response)`. For that one response object, this makes later `send()` and `json()` calls no-ops. Only Express's public API is involved: no Nest internals, and no other responses are touched.
- "Redirect back on an empty response" moved out of the interceptor and into `InertiaMiddleware`, which watches for an empty `send()` with a 200 or 201 status on an Inertia visit. This matches Laravel's after-response check, and Nest's `@Redirect()`, `@Render()`, and `@Res()` handlers behave as usual.

## Consequences

- No global state changes.
- With Express 5, a bare follow-up `send()` is already harmless. The guard matters when the follow-up reply carries a body: for example, an app-wide interceptor outside ours that wraps every result (`{ data }`) makes Nest call `json()` on the sent response, which throws `ERR_HTTP_HEADERS_SENT`. `test/api.spec.ts` ("Nest reply after an adapter response") covers that case and fails without the guard.
- An interceptor that runs *inside* ours and transforms results would wrap the `Responsable` itself. The README tells apps to let `Responsable` values pass through.
