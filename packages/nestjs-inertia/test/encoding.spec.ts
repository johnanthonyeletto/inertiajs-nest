import { IsEmail, IsNotEmpty, ValidateNested, validate } from 'class-validator'
import { Type, plainToInstance } from 'class-transformer'
import { encodePageForScript } from '../src/serialization.js'
import type { Page } from '../src/types.js'
import { toValidationErrors as flatten } from '../src/validation/class-validator.js'

describe('encodePageForScript', () => {
  it('escapes sequences that could close the script tag, and stays valid JSON', () => {
    const page: Page = {
      component: 'Posts/Show',
      props: { body: '</script><script>alert(1)</script>', line: 'a b' },
      url: '/posts/1',
      version: '',
    }

    const encoded = encodePageForScript(page)

    expect(encoded).not.toContain('</script>')
    expect(encoded).not.toContain('<')
    expect(encoded).toContain('"url":"\\/posts\\/1"')
    expect(encoded).not.toContain(String.fromCharCode(0x2028))
    expect(encoded).toContain('"line":"a\\u2028b"')
    expect(JSON.parse(encoded)).toEqual(page)
  })
})

class Address {
  @IsNotEmpty({ message: 'The city field is required.' })
  city: string
}

class Signup {
  @IsNotEmpty({ message: 'The email field is required.' })
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  email: string

  @ValidateNested()
  @Type(() => Address)
  address: Address
}

describe('flatten', () => {
  it('uses dot-notation keys and lists messages in declaration order', async () => {
    const errors = flatten(await validate(plainToInstance(Signup, { email: '', address: { city: '' } })))

    expect(errors).toEqual({
      email: ['The email field is required.', 'The email field must be a valid email address.'],
      'address.city': ['The city field is required.'],
    })
  })
})
