# 0003. Middleware subclassing; filter and pipe are opt-in

Status: Accepted (2026-11-11)

## Context

Every official adapter gives the app a middleware class it owns (Laravel's `HandleInertiaRequests`, Adonis' `BaseInertiaMiddleware`), where shared data, the asset version, and the root view are customised. The prototype took these as callbacks in the module config, and it registered a global exception filter and validation pipe that took over error handling and validation for the whole app.

## Decision

- `InertiaMiddleware` is a class to extend, with the hooks `share(request)`, `version(request)`, `rootView(context)`, and `onVersionChange()`. Its services come in through property injection (`@Inject(InertiaManager)`), so subclasses can declare their own constructor dependencies. `share()` is resolved when the page renders, so it sees state set by later middleware and guards.
- `InertiaModule` registers only the services and the global interceptor that sends Inertia responses.
- `InertiaExceptionFilter` and `InertiaValidationPipe` are registered by the app (`APP_FILTER` and `APP_PIPE`). Error pages come from overriding `renderError()` in a subclass of the filter. The filter extends Nest's `BaseExceptionFilter` and hands every request that isn't an Inertia visit or page load (that is, API calls) to Nest's default handling.
- Configuration is plain data (`defineConfig()`), so `forRootAsync()` works the usual Nest way.

## Consequences

- An app that never uses Inertia error pages or validation redirects sees no change in behaviour.
- Setup is a few lines longer. `nestjs-inertia install` scaffolds the middleware and prints the module wiring.
