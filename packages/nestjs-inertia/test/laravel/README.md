# Edge-case tests ported from inertia-laravel

Source: [inertiajs/inertia-laravel **v3.7.0**](https://github.com/inertiajs/inertia-laravel/tree/v3.7.0/tests)
(the latest v3.x release when this was written). The Inertia docs' "Building an
Adapter" guide points at this directory as the edge-case reference for server adapters.

Every `it()` names the PHP test it ports (`// ports ResponseTest::test_server_response`).
Tests that expose a genuine gap in our adapter are kept as `it.skip` with a
`// BUG:` comment pointing at the adapter code; un-skip them when fixing. None are skipped today.

`helpers.ts` holds the harness: `resolveProps()` (unit-level `PropsResolver`),
`visit()` (an `InertiaContext` on a bare Express request, like `new Response(...)->toResponse()`),
and `createApp()` + `route()` (a real Nest app with inline routes, like `Route::middleware(...)->get(...)`).

## Translation conventions

- Our context always shares `errors` (Laravel does so in `Middleware::share()`, which
  `new Response(...)` bypasses), so ported pages carry `props.errors = {}` and
  `sharedProps: ["errors"]`; exact-output assertions include them.
- `JsonSerializable` / `Arrayable` → objects with `toJSON()`. PHP ints beyond 2^53 → `bigint`.
- `Inertia::version(fn)` / `Inertia::share()` / `Inertia::flash()` → the same methods on `InertiaContext`.
- `Inertia::handleExceptionsUsing()` → an `InertiaExceptionFilter` subclass overriding `renderError()`.
- `EncryptHistoryMiddleware` → `@EncryptHistory()`; `->setVary()` → Nest's `@Header('Vary', ...)`.
- `Middleware::shareOnce()` → `share()` returning `Inertia.once(...)` props.
- `Session::put('errors', ViewErrorBag)` → seeding our session's `errors` (bag → field → messages).

## Ported (252 source tests, all passing)

| Spec | Source | Ported |
| --- | --- | ---: |
| `always-prop.spec.ts` | `AlwaysPropTest` | 2 |
| `defer-prop.spec.ts` | `DeferPropTest` | 4 |
| `optional-prop.spec.ts` | `OptionalPropTest` | 2 |
| `merge-prop.spec.ts` | `MergePropTest` | 14 |
| `deep-merge-prop.spec.ts` | `DeepMergePropTest` | 4 |
| `once-prop.spec.ts` | `OncePropTest` | 5 |
| `scroll-prop.spec.ts` | `ScrollPropTest` | 8 |
| `scroll-metadata.spec.ts` | `ScrollMetadataTest` | 1 |
| `props-resolver.spec.ts` | `PropsResolverTest` | 69 |
| `response.spec.ts` | `ResponseTest` | 52 (53 cases) |
| `response-factory.spec.ts` | `ResponseFactoryTest` | 42 |
| `middleware.spec.ts` | `MiddlewareTest` | 32 |
| `history.spec.ts` | `HistoryTest` | 9 |
| `exception-response.spec.ts` | `ExceptionResponseTest` | 6 |
| `component.spec.ts` | `ComponentTest` | 2 |

Fixed after porting (each was found by these tests):

- `ResponseFactoryTest::test_the_version_can_be_a_closure`: the 409 version check now runs after
  the handler (in the interceptor and exception filter), so `inertia.setVersion()` counts.
- `MiddlewareTest::test_existing_vary_header_values_are_preserved`,
  `MiddlewareTest::test_empty_vary_header_values_are_discarded`, and
  `MiddlewareTest::test_existing_vary_header_values_are_preserved_on_precognitive_routes`:
  `Vary: X-Inertia` (and `Vary: Precognition` on `@Precognitive()` routes) are now appended when
  the headers are written (`varyOnSend()`), so a route that sets `Vary` itself no longer drops them.

## Deliberately skipped

### Whole files

| Source | Reason |
| --- | --- |
| `BroadcastPropsTest`, `LivePropTest` | Live props / broadcasting: not implemented by this adapter. |
| `DirectiveTest`, most of `ComponentTest` | Blade directives and components. |
| `ServiceProviderTest`, `Commands/*` | Laravel service provider, config publishing, Artisan commands. |
| `HttpGatewayTest`, `SsrRenderFailedTest` | SSR HTTP gateway internals. |
| `DevTools/*` | Inertia DevTools. |
| `Testing/*` | Laravel's `AssertableInertia` testing API. |
| `ControllerTest` | `Inertia\Controller` (route-defaults controller) has no equivalent. |
| `HelperTest` | The global `inertia()` helper has no equivalent. |

### Individual tests

PHP-language concerns (no JS equivalent):

- `*PropTest::test_string_function_names_are_not_invoked` (Always, Defer, Optional, Merge, Once, Scroll),
  `ResponseTest::test_string_function_names_are_not_invoked_as_callables`,
  `PropsResolverTest::test_arrays_matching_callable_syntax_are_not_invoked` — PHP callable strings/arrays.
- `*PropTest::test_can_resolve_bindings_when_invoked` (Always, Defer, Optional, Merge, DeepMerge, Once) — container injection into closures.
- `AlwaysPropTest::test_can_accept_callables` — invokable (`__invoke`) objects.
- `PropsResolverTest::test_self_referencing_objects_do_not_recurse_forever` — cyclic values can't be JSON-encoded in JS at all.
- `PropsResolverTest::test_internal_objects_keep_the_shape_json_encode_gives_them` — PHP `DateTime`/`ArrayObject` encodings.
- `PropsResolverTest::test_pure_enums_are_left_for_json_encode_to_reject`, `ResponseFactoryTest::test_render_accepts_backed_enum`,
  `ResponseFactoryTest::test_render_accepts_unit_enum`, `ResponseFactoryTest::test_render_throws_for_non_string_backed_enum` — PHP enums.
- `PropsResolverTest::test_big_integers_are_not_wrapped_when_disabled`, `ResponseFactoryTest::test_big_integers_in_flash_data_are_untouched_when_disabled` —
  a JS `bigint` has no raw JSON form; without `preserveBigIntegers` the adapter rejects it by design (`src/serialization.ts`).
- `ResponseTest::test_responsable_with_invalid_key` — PHP private-property key mangling (`\0*\0`).

Laravel framework / API surface without an equivalent here:

- `ResponseTest::test_can_macro`, `ResponseFactoryTest::test_can_macro` — Laravel macros.
- `PropsResolverTest::test_nested_provides_inertia_properties_*` (3), `ResponseTest::test_inertia_responsable_objects`,
  `ResponseTest::test_inertia_response_type_prop`, `ResponseTest::test_*_from_provides_inertia_properties_*` (6),
  `ResponseFactoryTest::test_will_accept_instances_of_provides_inertia_props`, `..._arrays_containing_provides_inertia_props_in_render`,
  `..._can_share_instances_of_provides_inertia_props`, `..._can_share_arrays_containing_provides_inertia_props`,
  `..._shared_props_metadata_includes_keys_from_provides_inertia_properties` — the `ProvidesInertiaProperties`/`ProvidesInertiaProperty` interfaces.
- `ResponseFactoryTest::test_will_accept_arrayabe_props` — `render()` accepting an `Arrayable` instead of a props object.
- `PropsResolverTest::test_recorder_is_*` (2) — DevTools request recorder.
- `ResponseTest::test_resource_response`, `test_arrayable_prop_response`, `test_optional_resource_response`,
  `test_nested_optional_resource_response`, `ScrollMetadataTest::test_extract_metadata_from_*` (3) — Eloquent API resources and paginators.
- `ResponseTest::test_the_page_url_is_prefixed_with_the_proxy_prefix` — Symfony trusted-proxy `X-Forwarded-Prefix` handling.
- `ResponseFactoryTest::test_the_url_can_be_resolved_with_a_custom_resolver`, `MiddlewareTest::test_the_url_can_be_resolved_with_a_custom_resolver` — no URL-resolver hook.
- `ResponseFactoryTest::test_can_resolve_component_name_before_rendering`, `..._resolved_component_name_is_used_for_page_existence_checks`,
  `..._will_throw_exception_if_component_does_not_exist_when_ensuring_is_enabled`, `..._will_not_throw_exception_if_component_does_not_exist_when_ensuring_is_disabled` —
  `transformComponentUsing()` and `ensure_pages_exist`.
- `ResponseFactoryTest::test_can_flush_shared_data` — shared data is per-request here; nothing to flush.
- `ResponseFactoryTest::test_location_response_*_using_redirect_response*` (3) — `location()` taking a Laravel `RedirectResponse`.
- `ResponseFactoryTest::test_without_ssr_*` (2), `test_configure_ssr_request_using_*` (2), `test_ssr_renders_each_page_when_the_container_is_reused_between_requests`,
  `MiddlewareTest::test_middleware_registers_ssr_except_paths` — SSR gateway internals.
- `MiddlewareTest::test_no_response_value_can_be_customized_by_overriding_the_middleware_method` — no overridable `onEmptyResponse()` hook.
- `MiddlewareTest::test_middleware_can_change_the_root_view_via_a_property` — Blade view-name property (the `rootView()` override is ported).
- `MiddlewareTest::test_determine_the_version_by_a_hash_of_the_asset_url`, `..._mix_manifest` — Laravel `asset_url` config and Laravel Mix.
- `MiddlewareTest::test_*_previous_url_and_route` (10) — Laravel session previous-URL tracking.
- `MiddlewareTest::test_deferred_callbacks_*` (6) — Laravel's `defer()` helper.
- `HistoryTest::test_the_history_can_be_encrypted_via_middleware_alias` — Laravel middleware alias (`@EncryptHistory()` is ported).
- `HistoryTest::test_the_fragment_can_be_preserved_via_redirect_macro` — `RedirectResponse` macro (the context method is ported).
- `ExceptionResponseTest::test_exceptions_without_shared_data`, `..._with_shared_data_from_explicit_middleware`, `..._with_custom_root_view` —
  Laravel's opt-in `withSharedData()`/`usingMiddleware()`/`rootView()` on error pages; our error pages always render through the request's middleware.
