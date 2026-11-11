import type { RootViewContext } from './config.js'

/**
 * Everything that belongs in `<head>`: the server-rendered head elements
 * (title, meta tags) when SSR ran, followed by the asset tags.
 *
 * Works with any template engine, e.g. EJS: `<%- inertiaHead(ctx) %>`.
 */
export function inertiaHead(context: RootViewContext, options: { title?: string } = {}): string {
  const head = context.head || (options.title ? `<title>${escapeHtml(options.title)}</title>` : '')

  return [head, context.assets].filter(Boolean).join('\n    ')
}

/** The app's mounting point: the page-object script and root element, or the server-rendered markup. */
export function inertiaBody(context: RootViewContext): string {
  return context.body
}

/** A minimal HTML document. Override `InertiaMiddleware.rootView()` to customise it. */
export function defaultRootView(context: RootViewContext): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${inertiaHead(context)}
  </head>
  <body>
    ${inertiaBody(context)}
  </body>
</html>
`
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}
