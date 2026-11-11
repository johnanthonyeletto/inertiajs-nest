import {
  type DynamicModule,
  type InjectionToken,
  Module,
  type ModuleMetadata,
  type OptionalFactoryDependency,
  type Provider,
} from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import type { InertiaConfig } from './config.js'
import { INERTIA_CONFIG, INERTIA_VALIDATOR } from './constants.js'
import { InertiaInterceptor } from './interceptor.js'
import { InertiaManager } from './manager.js'
import { SsrGateway } from './ssr.js'
import { Vite } from './vite.js'

export interface InertiaModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => InertiaConfig | Promise<InertiaConfig>
  inject?: (InjectionToken | OptionalFactoryDependency)[]
}

/**
 * Registers the Inertia adapter: its services and the global interceptor
 * that sends Inertia responses. Then:
 *
 * 1. apply `InertiaMiddleware` (or your subclass) to your routes, after the
 *    session middleware, in your root module's `configure()`;
 * 2. optionally register `InertiaExceptionFilter` (`APP_FILTER`) and
 *    `InertiaValidationPipe` (`APP_PIPE`) for validation redirects,
 *    Precognition, and error pages.
 */
@Module({})
export class InertiaModule {
  static forRoot(config: InertiaConfig = {}): DynamicModule {
    return InertiaModule.create([{ provide: INERTIA_CONFIG, useValue: config }])
  }

  static forRootAsync(options: InertiaModuleAsyncOptions): DynamicModule {
    return InertiaModule.create(
      [{ provide: INERTIA_CONFIG, useFactory: options.useFactory, inject: options.inject ?? [] }],
      options.imports,
    )
  }

  private static create(providers: Provider[], imports: ModuleMetadata['imports'] = []): DynamicModule {
    return {
      module: InertiaModule,
      global: true,
      imports,
      providers: [
        ...providers,
        {
          provide: INERTIA_VALIDATOR,
          useFactory: (config: InertiaConfig) => config.validator ?? null,
          inject: [INERTIA_CONFIG],
        },
        Vite,
        SsrGateway,
        InertiaManager,
        { provide: APP_INTERCEPTOR, useClass: InertiaInterceptor },
      ],
      exports: [INERTIA_CONFIG, INERTIA_VALIDATOR, Vite, SsrGateway, InertiaManager],
    }
  }
}
