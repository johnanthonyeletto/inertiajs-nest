import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import type { Request, Response } from 'express'
import { ensureCsrfToken } from '../common/csrf.js'
import { regenerateSession } from '../common/session.js'
import { User } from '../database/models/index.js'
import { DEMO_USER } from '../database/seeder.js'
import { Inertia, type InertiaContext, ValidationException } from 'inertia-nest'
import { verifyPassword } from './password.js'

export class LoginDto {
  @IsNotEmpty({ message: 'The email field is required.' })
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  email: string

  @IsString()
  @IsNotEmpty({ message: 'The password field is required.' })
  password: string

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 'on' || value === '1')
  @IsBoolean()
  remember?: boolean
}

@Controller()
export class AuthController {
  @Get('login')
  create(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    if (request.user) {
      return inertia.redirect('/')
    }

    return inertia.render('Auth/Login', { demo: DEMO_USER })
  }

  @Post('login')
  async store(
    @Body() body: LoginDto,
    @Inertia() inertia: InertiaContext,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await User.findOne({ where: { email: body.email.toLowerCase() } })

    if (!user || !(await verifyPassword(body.password, user.password))) {
      throw ValidationException.withMessages({ email: 'These credentials do not match our records.' })
    }

    const intendedUrl = request.session.intendedUrl

    await regenerateSession(request)
    request.session.userId = user.id as number
    request.session.cookie.maxAge = body.remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 2
    ensureCsrfToken(request, response)

    return inertia.flash('toast', { type: 'success', message: `Welcome back, ${user.firstName}!` }).redirect(intendedUrl ?? '/')
  }

  @Post('logout')
  async destroy(@Inertia() inertia: InertiaContext, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await regenerateSession(request)
    ensureCsrfToken(request, response)

    // Wipe any encrypted history so "back" can't reveal authenticated pages.
    return inertia.clearHistory().redirect('/login')
  }
}
