import { Type } from 'class-transformer'
import {
  Equals,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNotIn,
  IsOptional,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator'
import { EmptyToNull, ToBoolean } from '../common/transforms.js'
import { User } from '../database/models/index.js'

class CompanyDto {
  @IsNotEmpty({ message: 'The company name field is required.' })
  @MaxLength(100)
  name: string

  @IsOptional()
  @EmptyToNull()
  @IsUrl({}, { message: 'The company website must be a valid URL.' })
  website: string | null
}

export class ProfileDto {
  @IsNotEmpty({ message: 'The name field is required.' })
  @MinLength(2, { message: 'The name field must be at least 2 characters.' })
  name: string

  @IsNotEmpty({ message: 'The email field is required.' })
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  email: string

  @IsIn(['free', 'pro', 'enterprise'], { message: 'Please choose a plan.' })
  plan: string

  @ValidateNested()
  @Type(() => CompanyDto)
  company: CompanyDto

  @ToBoolean()
  @Equals(true, { message: 'You must accept the terms.' })
  terms: boolean
}

export class UploadDto {
  @IsNotEmpty({ message: 'The title field is required.' })
  title: string
}

export class PrimaryValidationDto {
  @IsNotEmpty({ message: 'The name field is required.' })
  name: string

  @IsNotEmpty({ message: 'The email field is required.' })
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  email: string
}

export class SecondaryValidationDto {
  @IsNotEmpty({ message: 'The company field is required.' })
  company: string

  @IsNotEmpty({ message: 'The website field is required.' })
  @IsUrl({}, { message: 'The website must be a valid URL.' })
  website: string
}

@ValidatorConstraint({ name: 'uniqueEmail', async: true })
class UniqueEmailConstraint implements ValidatorConstraintInterface {
  async validate(email: unknown): Promise<boolean> {
    return typeof email !== 'string' || (await User.count({ where: { email: email.toLowerCase() } })) === 0
  }

  defaultMessage(): string {
    return 'This email has already been taken.'
  }
}

/** A server-only rule (it needs the database), which Precognition validates live. */
function IsUniqueEmail(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({ target: target.constructor, propertyName, options, validator: UniqueEmailConstraint })
}

function SameAs(property: string, options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'sameAs',
      target: target.constructor,
      propertyName,
      constraints: [property],
      options,
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          value === (args.object as Record<string, unknown>)[args.constraints[0] as string],
      },
    })
}

export class AccountDto {
  @IsNotEmpty({ message: 'The username field is required.' })
  @MinLength(3, { message: 'The username must be at least 3 characters.' })
  @Matches(/^[a-z0-9_]+$/i, { message: 'The username may only contain letters, numbers, and underscores.' })
  @IsNotIn(['admin', 'root', 'johndoe'], { message: 'This username is already taken.' })
  username: string

  @IsNotEmpty({ message: 'The email field is required.' })
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  @IsUniqueEmail()
  email: string

  @IsNotEmpty({ message: 'The password field is required.' })
  @MinLength(8, { message: 'The password must be at least 8 characters.' })
  password: string

  @SameAs('password', { message: 'The password confirmation does not match.' })
  passwordConfirmation: string
}

export class GreetingDto {
  @IsNotEmpty({ message: 'Please tell us your name.' })
  @MaxLength(40, { message: 'That name is a bit long (40 characters max).' })
  name: string
}
