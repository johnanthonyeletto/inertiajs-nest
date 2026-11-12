import {
  type ArgumentMetadata,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  type PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { Request } from 'express'
import { Header, INERTIA_VALIDATOR } from './constants.js'
import { currentRequest } from './request-context.js'
import { type ErrorMessages, normalizeErrorMessages, type ValidationErrors } from './support.js'

export type { ErrorMessages, ValidationErrors }

/**
 * Thrown when validation fails. Inertia visits are redirected back with the
 * errors flashed to the `errors` prop; JSON and Precognition requests get a 422.
 */
export class ValidationException extends UnprocessableEntityException {
  constructor(
    readonly errors: ValidationErrors,
    readonly errorBag = 'default',
  ) {
    super({ message: firstMessage(errors) ?? 'The given data was invalid.', errors })
  }

  /** Fail validation manually, e.g. for checks that need the database. */
  static withMessages(messages: ErrorMessages, errorBag = 'default'): ValidationException {
    return new ValidationException(normalizeErrorMessages(messages), errorBag)
  }
}

/** Thrown when a Precognition request passes validation; answered with a 204. */
export class PrecognitionSuccessException extends HttpException {
  constructor() {
    super('', HttpStatus.NO_CONTENT)
  }
}

export type ValidationResult = { success: true; value: unknown } | { success: false; errors: ValidationErrors }

/**
 * Validates a pipe argument against its declared type. Implementations ship
 * for class-validator (`@johnanthonyeletto/nestjs-inertia/validation/class-validator`) and Zod
 * (`@johnanthonyeletto/nestjs-inertia/validation/zod`).
 */
export interface InertiaValidator {
  /** Whether the validator handles arguments declared with this type. */
  supports(metatype: unknown): boolean
  validate(value: unknown, metatype: unknown, metadata: ArgumentMetadata): Promise<ValidationResult>
}

/**
 * Validates `@Body()` and `@Query()` arguments with the configured validator
 * and converts failures into a `ValidationException`. On Precognition
 * requests only the fields listed in `Precognition-Validate-Only` (when
 * present) are reported.
 *
 * Register it globally (`{ provide: APP_PIPE, useClass: InertiaValidationPipe }`,
 * using the `validator` config option) or per parameter
 * (`@Body(new InertiaValidationPipe(classValidator()))`).
 */
@Injectable()
export class InertiaValidationPipe implements PipeTransform {
  private static warned = false

  constructor(@Optional() @Inject(INERTIA_VALIDATOR) private readonly validator?: InertiaValidator | null) {
    if (!validator && !InertiaValidationPipe.warned) {
      InertiaValidationPipe.warned = true
      new Logger('Inertia').warn('InertiaValidationPipe has no validator; set the `validator` config option.')
    }
  }

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const { metatype, type } = metadata

    if ((type !== 'body' && type !== 'query') || !this.validator?.supports(metatype)) {
      return value
    }

    const result = await this.validator.validate(value, metatype, metadata)
    const request = currentRequest()
    // Only the body is subject to `Precognition-Validate-Only`; query errors always count.
    const errors = result.success ? {} : precognitiveErrors(result.errors, type === 'body' ? request : null)

    if (Object.keys(errors).length > 0) {
      throw new ValidationException(errors)
    }

    // Precognition requests never reach the handler (see @Precognitive()), so
    // a body that failed only on fields outside `Precognition-Validate-Only`
    // can pass through.
    return result.success ? result.value : value
  }
}

/**
 * On a Precognition request listing `Precognition-Validate-Only` fields,
 * keep only the errors for those fields (and their nested fields). Other
 * requests, and `request: null`, keep every error.
 */
export function precognitiveErrors(
  errors: ValidationErrors,
  request: Request | null | undefined = currentRequest(),
): ValidationErrors {
  if (!request?.precognitive) {
    return errors
  }

  const only = (request.get(Header.PRECOGNITION_VALIDATE_ONLY) ?? '').split(',').filter(Boolean)

  if (only.length === 0) {
    return errors
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => only.some((name) => field === name || field.startsWith(`${name}.`))),
  )
}

/**
 * Build the exception for a set of validation errors, applying
 * `Precognition-Validate-Only`: a `PrecognitionSuccessException` when no
 * relevant errors remain. Used by the validator integrations' exception
 * factories for Nest's own `ValidationPipe`.
 */
export function validationExceptionFor(errors: ValidationErrors): HttpException {
  const relevant = precognitiveErrors(errors)

  return Object.keys(relevant).length > 0 ? new ValidationException(relevant) : new PrecognitionSuccessException()
}

function firstMessage(errors: ValidationErrors): string | undefined {
  return Object.values(errors)[0]?.[0]
}

/** Types Nest passes for undecorated or primitive parameters, which have nothing to validate. */
export function isNativeType(metatype: unknown): boolean {
  return ([String, Boolean, Number, Array, Object] as unknown[]).includes(metatype)
}
