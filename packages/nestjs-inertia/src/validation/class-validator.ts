/**
 * class-validator integration (`@johnanthonyeletto/nestjs-inertia/validation/class-validator`).
 * Requires the optional peer dependencies `class-validator` and `class-transformer`.
 */
import type { HttpException } from '@nestjs/common'
import { type ClassTransformOptions, plainToInstance } from 'class-transformer'
import { validate, type ValidationError, type ValidatorOptions } from 'class-validator'
import type { ValidationErrors } from '../support.js'
import { type InertiaValidator, isNativeType, validationExceptionFor } from '../validation.js'

export interface ClassValidatorOptions {
  /** Defaults to `{ whitelist: true, forbidUnknownValues: false }`. */
  validatorOptions?: ValidatorOptions
  transformOptions?: ClassTransformOptions
}

/** Validates class DTOs decorated with class-validator. */
export function classValidator(options: ClassValidatorOptions = {}): InertiaValidator {
  const validatorOptions = options.validatorOptions ?? { whitelist: true, forbidUnknownValues: false }

  return {
    supports: (metatype) => typeof metatype === 'function' && !isNativeType(metatype),

    async validate(value, metatype) {
      const instance = plainToInstance(metatype as new () => object, value ?? {}, options.transformOptions) as object
      const errors = toValidationErrors(await validate(instance, validatorOptions))

      return Object.keys(errors).length > 0 ? { success: false, errors } : { success: true, value: instance }
    },
  }
}

/** Flatten nested class-validator errors into dot-notation keys (`address.city`, `items.0.name`). */
export function toValidationErrors(errors: ValidationError[], prefix = ''): ValidationErrors {
  const result: ValidationErrors = {}

  for (const error of errors) {
    const key = prefix ? `${prefix}.${error.property}` : error.property

    if (error.constraints) {
      result[key] = Object.values(error.constraints).reverse()
    }

    Object.assign(result, toValidationErrors(error.children ?? [], key))
  }

  return result
}

/**
 * An `exceptionFactory` for Nest's own `ValidationPipe`, for apps that keep it:
 *
 * ```ts
 * new ValidationPipe({ exceptionFactory: inertiaExceptionFactory })
 * ```
 *
 * Failures become `ValidationException`s (redirect back with errors for
 * Inertia visits), with Precognition's `Validate-Only` fields applied.
 */
export function inertiaExceptionFactory(errors: ValidationError[]): HttpException {
  return validationExceptionFor(toValidationErrors(errors))
}
