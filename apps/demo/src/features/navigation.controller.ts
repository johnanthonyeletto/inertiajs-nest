import { Controller, Delete, Get, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { AuthGuard } from '../auth/auth.js'
import { now, randomInt, sleep } from '../common/time.js'
import { EncryptHistory, Inertia, type InertiaContext } from 'inertia-nest'

@Controller('features')
@UseGuards(AuthGuard)
export class NavigationController {
  @Get()
  index(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Index')
  }

  @Get('links')
  links(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Navigation/Links', { timestamp: now() })
  }

  @Post('links')
  linkPost(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    return this.linkAction(inertia, request)
  }

  @Put('links')
  linkPut(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    return this.linkAction(inertia, request)
  }

  @Patch('links')
  linkPatch(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    return this.linkAction(inertia, request)
  }

  @Delete('links')
  linkDelete(@Inertia() inertia: InertiaContext, @Req() request: Request) {
    return this.linkAction(inertia, request)
  }

  @Get('manual-visits')
  async manualVisits(@Inertia() inertia: InertiaContext, @Query('delay') delay?: string) {
    await sleep(Math.min(Number(delay) || 0, 5) * 1000)

    return inertia.render('Features/Navigation/ManualVisits', {
      timestamp: now(),
      counter: randomInt(1, 1000),
    })
  }

  @Get('redirects')
  redirects(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Navigation/Redirects', { timestamp: now() })
  }

  @Post('redirects/back')
  redirectBack(@Inertia() inertia: InertiaContext) {
    return inertia.flash('toast', { type: 'success', message: 'Redirected back to the previous page.' }).back()
  }

  @Post('redirects/to-route')
  redirectToRoute(@Inertia() inertia: InertiaContext) {
    return inertia.flash('toast', { type: 'success', message: 'Redirected to the links page.' }).redirect('/features/links')
  }

  @Put('redirects/see-other')
  redirectSeeOther(@Inertia() inertia: InertiaContext) {
    // A 302 after PUT is sent as 303 See Other, so the browser follows with GET.
    return inertia
      .flash('toast', { type: 'success', message: 'PUT answered with 303 See Other, followed by a GET.' })
      .redirect('/features/redirects')
  }

  @Post('redirects/external')
  redirectExternal(@Inertia() inertia: InertiaContext) {
    return inertia.location('https://inertiajs.com')
  }

  @Get('url-fragments')
  urlFragments(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Navigation/UrlFragments', { timestamp: now(), redirectedFrom: null })
  }

  @Get('url-fragments/redirect-hash')
  redirectWithHash(@Inertia() inertia: InertiaContext) {
    // Fragments are lost on XHR redirects, so this becomes a 409 with X-Inertia-Redirect.
    return inertia.redirect('/features/url-fragments#server-section')
  }

  @Get('url-fragments/preserve-redirect')
  preserveFragmentRedirect(@Inertia() inertia: InertiaContext) {
    return inertia.preserveFragment().redirect('/features/url-fragments/preserve-target')
  }

  @Get('url-fragments/preserve-target')
  preserveFragmentTarget(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Navigation/UrlFragments', {
      timestamp: now(),
      redirectedFrom: '/features/url-fragments/preserve-redirect',
    })
  }

  @Get('scroll-management')
  scrollManagement(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Navigation/ScrollManagement', {
      timestamp: now(),
      items: Array.from({ length: 40 }, (_, index) => ({ id: index + 1, title: `Item #${index + 1}` })),
    })
  }

  @Get('history')
  @EncryptHistory()
  history(@Inertia() inertia: InertiaContext, @Query('visit') visit?: string) {
    return inertia.render('Features/Navigation/History', {
      visit: Number(visit) || 0,
      timestamp: now(),
      secret: `secret-${randomInt(1000, 9999)}`,
    })
  }

  @Post('history/clear')
  clearHistory(@Inertia() inertia: InertiaContext) {
    return inertia
      .clearHistory()
      .flash('toast', { type: 'success', message: 'Encrypted history was cleared by the server.' })
      .redirect('/features/history')
  }

  @Get('instant-visits')
  instantVisits(@Inertia() inertia: InertiaContext) {
    return inertia.render('Features/Navigation/InstantVisits', { timestamp: now() })
  }

  @Get('instant-visits/target')
  async instantVisitTarget(@Inertia() inertia: InertiaContext, @Query('delay') delay?: string) {
    await sleep(Math.min(Number(delay) || 1.5, 5) * 1000)

    return inertia.render('Features/Navigation/InstantVisitTarget', {
      greeting: 'Hello from the server!',
      timestamp: now(),
      items: ['Alpha', 'Bravo', 'Charlie'].map((name, index) => ({ id: index + 1, name })),
    })
  }

  @Get('view-transitions')
  viewTransitions(@Inertia() inertia: InertiaContext, @Query('photo') photo?: string) {
    return inertia.render('Features/Navigation/ViewTransitions', { photo: Number(photo) || null })
  }

  private linkAction(inertia: InertiaContext, request: Request) {
    return inertia
      .flash('toast', { type: 'success', message: `${request.method} request received at ${now()}.` })
      .back()
  }
}
