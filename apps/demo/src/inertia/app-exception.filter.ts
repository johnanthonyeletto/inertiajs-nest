import { Catch } from '@nestjs/common'
import { escapeHtml, HtmlResponse, InertiaExceptionFilter, type RenderErrorContext } from '@johnanthonyeletto/nestjs-inertia'

/** Renders errors on Inertia visits and page loads; API requests keep Nest's JSON errors. */
@Catch()
export class AppExceptionFilter extends InertiaExceptionFilter {
  renderError({ status, error, inertia }: RenderErrorContext) {
    if (status === 401) {
      return inertia.redirect('/login')
    }

    if (status === 419) {
      return inertia.flash('toast', { type: 'error', message: 'The page expired, please try again.' }).back()
    }

    if ([403, 404, 500, 503].includes(status)) {
      const message = error instanceof Error && status < 500 ? error.message : null

      return inertia.render('Error', { status, message }).status(status)
    }

    // Any other status gets a plain HTML response, which the Inertia client
    // shows in its error modal (dev-style), demonstrating `httpException`.
    const message = error instanceof Error ? error.message : 'Unexpected error'

    return new HtmlResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem"><h1>${status}</h1><p>${escapeHtml(message)}</p>` +
        `<p>This is a non-Inertia response, so the client displays it in a modal.</p></body></html>`,
      status,
    )
  }
}
