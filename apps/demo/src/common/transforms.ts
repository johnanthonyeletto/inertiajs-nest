import { Transform } from 'class-transformer'

/** Form fields arrive as `''` when left blank; treat them as `null`. */
export const EmptyToNull = () => Transform(({ value }) => (value === '' ? null : value))

/** Multipart fields are strings; convert numeric ids (blank → `null`). */
export const ToNumberOrNull = () =>
  Transform(({ value }) => (value === '' || value === null || value === undefined ? null : Number(value)))

/** Accept JSON booleans as well as `'true'`, `'1'` and `'on'` from forms and query strings. */
export const ToBoolean = () =>
  Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 'on')
