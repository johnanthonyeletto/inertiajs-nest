import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { InertiaModule, InertiaValidationPipe } from 'inertia-nest'
import { AuthController } from './auth/auth.controller.js'
import { AuthMiddleware } from './auth/auth.js'
import { CsrfMiddleware } from './common/csrf.js'
import { SessionMiddleware } from './common/session.js'
import { ContactsController } from './crm/contacts.controller.js'
import { DashboardController } from './crm/dashboard.controller.js'
import { OrganizationsController } from './crm/organizations.controller.js'
import { DatabaseModule } from './database/database.module.js'
import { ApiController } from './features/api.controller.js'
import { DataController } from './features/data.controller.js'
import { FormsController } from './features/forms.controller.js'
import {
  ErrorsController,
  EventsController,
  LayoutsController,
  PrefetchingController,
  StateController,
} from './features/misc.controller.js'
import { NavigationController } from './features/navigation.controller.js'
import { AppExceptionFilter } from './inertia/app-exception.filter.js'
import { HandleInertiaRequests } from './inertia/handle-inertia-requests.js'
import { inertiaConfig } from './inertia/inertia.config.js'

@Module({
  imports: [DatabaseModule, InertiaModule.forRoot(inertiaConfig)],
  controllers: [
    AuthController,
    DashboardController,
    OrganizationsController,
    ContactsController,
    NavigationController,
    FormsController,
    DataController,
    PrefetchingController,
    StateController,
    LayoutsController,
    EventsController,
    ErrorsController,
    ApiController,
  ],
  providers: [
    SessionMiddleware,
    CsrfMiddleware,
    AuthMiddleware,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_PIPE, useClass: InertiaValidationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Order matters: the session must exist before Inertia (flash data,
    // errors) and CSRF run, and the Inertia context should exist before any
    // middleware that may throw, so errors can render as Inertia responses.
    consumer
      .apply(SessionMiddleware, HandleInertiaRequests, CsrfMiddleware, AuthMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL })
  }
}
