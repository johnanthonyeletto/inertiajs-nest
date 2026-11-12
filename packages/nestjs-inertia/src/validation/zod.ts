/**
 * Zod integration (`@johnanthonyeletto/nestjs-inertia/validation/zod`). Works with Zod 3.25+ and 4.
 *
 * Nest validates parameters by their declared class, so schemas are attached
 * to a class with `zodDto()` (classes from `nestjs-zod`'s `createZodDto()`
 * work too):
 *
 * ```ts
 * const CreateContact = z.object({ name: z.string().min(1) })
 * class CreateContactDto extends zodDto(CreateContact) {}
 *
 * @Post() store(@Body() body: CreateContactDto) {}
 * ```
 */
import type { HttpException } from '@nestjs/common'
import type * as z from 'zod'
import type { ValidationErrors } from '../support.js'
import { type InertiaValidator, validationExceptionFor } from '../validation.js'

interface ZodIssueLike {
  path: PropertyKey[]
  message: string
}

/** The part of a Zod schema the validator relies on. */
export interface ZodSchemaLike {
  safeParseAsync(
    value: unknown,
  ): Promise<{ success: true; data: unknown } | { success: false; error: { issues: ZodIssueLike[] } }>
}

export interface ZodDto<S extends z.ZodType> {
  new (): z.output<S>
  readonly schema: S
}

/** A class carrying a Zod schema, usable as a `@Body()` or `@Query()` type. */
export function zodDto<S extends z.ZodType>(schema: S): ZodDto<S> {
  return class {
    static readonly schema = schema
  } as unknown as ZodDto<S>
}

/** Validates parameters whose type carries a static Zod `schema`. */
export function zodValidator(): InertiaValidator {
  return {
    supports: (metatype) => schemaOf(metatype) !== null,

    async validate(value, metatype) {
      const result = await schemaOf(metatype)!.safeParseAsync(value ?? {})

      return result.success
        ? { success: true, value: result.data }
        : { success: false, errors: toValidationErrors(result.error.issues) }
    },
  }
}

/** Group Zod issues by dot-notation path (`address.city`, `items.0.name`). */
export function toValidationErrors(issues: ZodIssueLike[]): ValidationErrors {
  const errors: ValidationErrors = {}

  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root'
    ;(errors[key] ??= []).push(issue.message)
  }

  return errors
}

/** Converts a `ZodError` (e.g. in a custom pipe) into the matching Inertia exception. */
export function zodExceptionFor(error: { issues: ZodIssueLike[] }): HttpException {
  return validationExceptionFor(toValidationErrors(error.issues))
}

function schemaOf(metatype: unknown): ZodSchemaLike | null {
  const schema = (metatype as { schema?: unknown } | null | undefined)?.schema

  return typeof (schema as ZodSchemaLike | undefined)?.safeParseAsync === 'function' ? (schema as ZodSchemaLike) : null
}
