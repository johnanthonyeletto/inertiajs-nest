import { Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { InertiaMiddleware, type RootViewContext, inertiaBody, inertiaHead } from '@johnanthonyeletto/nestjs-inertia'
import { APP_NAME } from './inertia.config.js'

@Injectable()
export class HandleInertiaRequests extends InertiaMiddleware {
  share(request: Request) {
    return {
      appName: APP_NAME,
      auth: {
        user: request.user?.toPublic() ?? null,
      },
    }
  }

  // The asset version defaults to a hash of the Vite manifest. The "asset
  // versioning" demo adds a per-session salt to simulate a deployment.
  async version(request: Request) {
    return [await super.version(request), request.session?.assetVersionSalt].filter(Boolean).join('-')
  }

  rootView(context: RootViewContext) {
    return `<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    ${inertiaHead(context, { title: APP_NAME })}
  </head>
  <body class="h-full antialiased text-slate-800">
    ${inertiaBody(context)}
  </body>
</html>
`
  }
}
