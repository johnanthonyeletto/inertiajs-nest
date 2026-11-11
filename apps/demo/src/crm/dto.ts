import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { EmptyToNull, ToNumberOrNull } from '../common/transforms.js'

const required = (field: string) => ({ message: `The ${field} field is required.` })
const max = (field: string, length: number) => ({ message: `The ${field} field must not be greater than ${length} characters.` })

export class FiltersDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['with', 'only', ''])
  trashed?: '' | 'with' | 'only'
}

export class OrganizationDto {
  @IsNotEmpty(required('name'))
  @MaxLength(100, max('name', 100))
  name: string

  @IsOptional()
  @EmptyToNull()
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  @MaxLength(50, max('email', 50))
  email: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(50, max('phone', 50))
  phone: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(150, max('address', 150))
  address: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(50, max('city', 50))
  city: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(50, max('province/state', 50))
  region: string | null

  @IsOptional()
  @EmptyToNull()
  @IsIn(['US', 'CA'], { message: 'The selected country is invalid.' })
  country: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(25, max('postal code', 25))
  postalCode: string | null
}

export class ContactDto {
  @IsNotEmpty(required('first name'))
  @MaxLength(50, max('first name', 50))
  firstName: string

  @IsNotEmpty(required('last name'))
  @MaxLength(50, max('last name', 50))
  lastName: string

  @IsOptional()
  @ToNumberOrNull()
  @IsInt({ message: 'The selected organization is invalid.' })
  organizationId: number | null

  @IsOptional()
  @EmptyToNull()
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  @MaxLength(50, max('email', 50))
  email: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(50, max('phone', 50))
  phone: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(150, max('address', 150))
  address: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(50, max('city', 50))
  city: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(50, max('province/state', 50))
  region: string | null

  @IsOptional()
  @EmptyToNull()
  @IsIn(['US', 'CA'], { message: 'The selected country is invalid.' })
  country: string | null

  @IsOptional()
  @EmptyToNull()
  @MaxLength(25, max('postal code', 25))
  postalCode: string | null
}

export class NoteDto {
  @IsNotEmpty(required('note'))
  @MaxLength(1000, max('note', 1000))
  body: string
}
