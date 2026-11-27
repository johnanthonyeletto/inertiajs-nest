// Live props over HTTP: live shared props, lazy closures on live reloads,
// one-time session state surviving partial reloads, and `X-Socket-Id`.
import { Inertia, type InertiaContext } from '../src/index.js'
import { closeApps, createApp, exampleMiddleware, inertiaHeaders, route } from './laravel/helpers.js'

afterEach(closeApps)

class MirrorChanged {
  static readonly eventName = 'mirror.changed'
}

class SourceChanged {
  static readonly eventName = 'source.changed'
}

const alert42 = { name: 'alerts.42', type: 'private' } as const
const sources = { name: 'sources', type: 'private' } as const

/** The headers Inertia's client sends when a live prop reloads. */
const liveReload = (component: string, only: string) => ({
  ...inertiaHeaders,
  'X-Inertia-Partial-Component': component,
  'X-Inertia-Partial-Data': only,
})

describe('live props over HTTP', () => {
  it('announces live page and shared props on a full visit', async () => {
    const { http } = await createApp({
      middleware: exampleMiddleware(null, {
        sources: Inertia.live(() => ['Linear'], { on: SourceChanged, channel: sources }),
      }),
      routes: [
        route('GET', '/alerts/42', ({ inertia }) =>
          inertia.render('Alerts/Show', {
            mirrors: Inertia.live(() => ['Synced'], { on: MirrorChanged, channel: alert42 }),
          }),
        ),
      ],
    })

    const page = (await http().get('/alerts/42').set(inertiaHeaders)).body

    expect(page.props).toMatchObject({ sources: ['Linear'], mirrors: ['Synced'] })
    expect(page.liveProps).toEqual({
      sources: { listeners: [{ channel: sources, events: ['source.changed'] }] },
      mirrors: { listeners: [{ channel: alert42, events: ['mirror.changed'] }] },
    })
  })

  it('runs only the requested closures on a live reload, in page and shared props', async () => {
    const ran: string[] = []
    const track = (name: string, value: unknown) => () => {
      ran.push(name)
      return value
    }

    const { http } = await createApp({
      middleware: exampleMiddleware(null, {
        sources: Inertia.live(track('sources', ['Linear']), { on: SourceChanged, channel: sources }),
        sidebarCounts: track('sidebarCounts', { alerts: 3 }),
      }),
      routes: [
        route('GET', '/alerts/42', ({ inertia }) =>
          inertia.render('Alerts/Show', {
            alert: track('alert', { id: 42 }),
            mirrors: Inertia.live(track('mirrors', ['Synced']), { on: MirrorChanged, channel: alert42 }),
          }),
        ),
      ],
    })

    const page = (await http().get('/alerts/42').set(liveReload('Alerts/Show', 'mirrors,sources'))).body

    expect(page.props).toEqual({ errors: {}, mirrors: ['Synced'], sources: ['Linear'] })
    expect(Object.keys(page.liveProps).sort()).toEqual(['mirrors', 'sources'])
    expect(ran.sort()).toEqual(['mirrors', 'sources'])
  })

  describe('one-time session state', () => {
    const flashed = () => ({
      flash: { message: 'Status changed' },
      errors: { default: { title: ['The title field is required.'] } },
      clearHistory: true,
    })

    async function alertApp(session: ReturnType<typeof flashed>) {
      return createApp({
        session,
        routes: [
          route('GET', '/alerts/42', ({ inertia }) =>
            inertia.render('Alerts/Show', {
              mirrors: Inertia.live(() => ['Synced'], { on: MirrorChanged, channel: alert42 }),
            }),
          ),
        ],
      })
    }

    it.each([
      ['a live reload of the page', liveReload('Alerts/Show', 'mirrors')],
      ['a partial reload naming a different component', liveReload('Alerts/Index', 'alerts')],
      [
        'a partial reload with an except list',
        { ...inertiaHeaders, 'X-Inertia-Partial-Component': 'Alerts/Show', 'X-Inertia-Partial-Except': 'alert' },
      ],
      // Each header counts on its own, without X-Inertia-Partial-Component.
      ['a request with only X-Inertia-Partial-Data', { ...inertiaHeaders, 'X-Inertia-Partial-Data': 'mirrors' }],
      ['a request with only X-Inertia-Partial-Except', { ...inertiaHeaders, 'X-Inertia-Partial-Except': 'alert' }],
    ])('survives %s, for the next full visit', async (_, headers) => {
      const session = flashed()
      const { http } = await alertApp(session)

      const partial = (await http().get('/alerts/42').set(headers)).body

      expect(partial).not.toHaveProperty('flash')
      expect(partial).not.toHaveProperty('clearHistory')
      expect(partial.props.errors).toEqual({})
      expect(session).toEqual(flashed())

      const full = (await http().get('/alerts/42').set(inertiaHeaders)).body

      expect(full.flash).toEqual({ message: 'Status changed' })
      expect(full.clearHistory).toBe(true)
      expect(full.props.errors).toEqual({ title: 'The title field is required.' })
    })

    it('is still consumed by a full visit', async () => {
      const session = flashed()
      const { http } = await alertApp(session)

      await http().get('/alerts/42').set(inertiaHeaders)
      const next = (await http().get('/alerts/42').set(inertiaHeaders)).body

      expect(next).not.toHaveProperty('flash')
      expect(next.props.errors).toEqual({})
    })
  })

  it('exposes X-Socket-Id on the request', async () => {
    const seen: Array<string | null> = []
    const { http } = await createApp({
      routes: [
        route('POST', '/alerts/42/status', ({ inertia }: { inertia: InertiaContext }) => {
          seen.push(inertia.socketId)
          return inertia.back()
        }),
      ],
    })

    await http().post('/alerts/42/status').set({ ...inertiaHeaders, 'X-Socket-Id': '1234.5678' })
    await http().post('/alerts/42/status').set(inertiaHeaders)

    expect(seen).toEqual(['1234.5678', null])
  })
})
