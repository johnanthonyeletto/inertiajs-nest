export type { InertiaConfig, RootViewContext, SsrConfig, ViteConfig } from './config.js'
export { defineConfig } from './config.js'
export { Header, INERTIA_CONFIG, INERTIA_VALIDATOR } from './constants.js'
export { InertiaContext, type BuildPageOptions, type ErrorMessages } from './context.js'
export { EncryptHistory, Inertia, Precognitive } from './decorators.js'
export { InertiaExceptionFilter, type RenderErrorContext } from './exception.filter.js'
export { isInertiaRequest, markResponseHandled } from './express.js'
export { InertiaInterceptor } from './interceptor.js'
export { InertiaModule, type InertiaModuleAsyncOptions } from './inertia.module.js'
export { InertiaManager, type InertiaHooks } from './manager.js'
export { InertiaMiddleware } from './middleware.js'
export {
  AlwaysProp,
  DeferProp,
  MergeProp,
  OnceProp,
  OptionalProp,
  Prop,
  props,
  ScrollProp,
  type ProvidesScrollMetadata,
} from './props.js'
export { PropsResolver, type PropsResolverOptions } from './props-resolver.js'
export { currentRequest } from './request-context.js'
export { InertiaResponse } from './response.js'
export { HtmlResponse, LocationResponse, RedirectResponse, Responsable } from './responses.js'
export { defaultRootView, escapeHtml, inertiaBody, inertiaHead } from './root-view.js'
export { encodeBigInt, encodePageForScript, reviveBigInt, serializePage } from './serialization.js'
export {
  expressSession,
  objectSession,
  type InertiaSession,
  type InertiaSessionData,
  type InertiaSessionResolver,
} from './session.js'
export { SsrGateway, type SsrError, type SsrResult } from './ssr.js'
export type {
  ComponentProps,
  InertiaPages,
  Page,
  PageMetadata,
  PageProps,
  PropValue,
  ScrollMetadata,
  SharedProps,
} from './types.js'
export {
  InertiaValidationPipe,
  isNativeType,
  PrecognitionSuccessException,
  precognitiveErrors,
  ValidationException,
  validationExceptionFor,
  type InertiaValidator,
  type ValidationErrors,
  type ValidationResult,
} from './validation.js'
export { Vite } from './vite.js'
