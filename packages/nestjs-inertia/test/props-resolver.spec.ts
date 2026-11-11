import type { Request } from 'express'
import { props as Inertia } from '../src/props.js'
import { PropsResolver, type PageProps } from '../src/props-resolver.js'
import { setPath } from '../src/support.js'

function request(headers: Record<string, string> = {}): Request {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))

  return { get: (name: string) => normalized[name.toLowerCase()] } as unknown as Request
}

const partial = (component: string, headers: Record<string, string> = {}) =>
  request({ 'X-Inertia': 'true', 'X-Inertia-Partial-Component': component, ...headers })

async function resolve(props: PageProps, req = request({ 'X-Inertia': 'true' }), shared: PageProps = {}) {
  return new PropsResolver(req, 'Page').resolve(shared, props)
}

describe('PropsResolver — full visits', () => {
  it('resolves values, callbacks and promises, and serializes toJSON() objects', async () => {
    const [props] = await resolve({
      plain: 1,
      callback: () => 'called',
      async: async () => ({ nested: true }),
      promise: Promise.resolve('awaited'),
      model: { toJSON: () => ({ id: 1 }) },
      date: new Date('2026-01-01T00:00:00.000Z'),
    })

    expect(props).toEqual({
      plain: 1,
      callback: 'called',
      async: { nested: true },
      promise: 'awaited',
      model: { id: 1 },
      date: '2026-01-01T00:00:00.000Z',
    })
  })

  it('skips optional props without announcing them', async () => {
    const optional = vi.fn(() => 'never')
    const [props, metadata] = await resolve({ a: 1, lazy: Inertia.optional(optional) })

    expect(props).toEqual({ a: 1 })
    expect(metadata).toEqual({})
    expect(optional).not.toHaveBeenCalled()
  })

  it('announces deferred props by group without resolving them', async () => {
    const callback = vi.fn(() => 'value')
    const [props, metadata] = await resolve({
      a: Inertia.defer(callback),
      b: Inertia.defer(callback, 'sidebar'),
      c: Inertia.defer(callback),
    })

    expect(props).toEqual({})
    expect(metadata.deferredProps).toEqual({ default: ['a', 'c'], sidebar: ['b'] })
    expect(callback).not.toHaveBeenCalled()
  })

  it('labels merge, prepend, deep merge and match-on props', async () => {
    const [props, metadata] = await resolve({
      posts: Inertia.merge([{ id: 1 }]).matchOn('id'),
      notifications: Inertia.merge([{ id: 2 }]).prepend(),
      conversations: Inertia.deepMerge({ data: [{ id: 1 }] }).matchOn('data.id'),
      feed: Inertia.merge({ items: [], pinned: [] }).append('items').prepend('pinned'),
    })

    expect(props.posts).toEqual([{ id: 1 }])
    expect(metadata).toEqual({
      mergeProps: ['posts', 'feed.items'],
      prependProps: ['notifications', 'feed.pinned'],
      deepMergeProps: ['conversations'],
      matchPropsOn: ['posts.id', 'conversations.data.id'],
    })
  })

  it('emits once metadata (custom keys, expiry) and skips props the client already has', async () => {
    const until = new Date(Date.now() + 60_000)
    const props = {
      plans: Inertia.once(() => ['basic']),
      aliased: Inertia.once(() => 'x').as('shared-key'),
      expiring: Inertia.once(() => 'y').until(until),
      fresh: Inertia.once(() => 'z').fresh(),
    }

    const [first, firstMeta] = await resolve(props)
    expect(first).toEqual({ plans: ['basic'], aliased: 'x', expiring: 'y', fresh: 'z' })
    expect(firstMeta.onceProps).toEqual({
      plans: { prop: 'plans', expiresAt: null },
      'shared-key': { prop: 'aliased', expiresAt: null },
      expiring: { prop: 'expiring', expiresAt: until.getTime() },
      fresh: { prop: 'fresh', expiresAt: null },
    })

    const [second, secondMeta] = await resolve(
      props,
      request({ 'X-Inertia': 'true', 'X-Inertia-Except-Once-Props': 'plans,shared-key,expiring,fresh' }),
    )
    expect(second).toEqual({ fresh: 'z' })
    expect(Object.keys(secondMeta.onceProps!)).toEqual(['plans', 'shared-key', 'expiring', 'fresh'])
  })

  it('ignores the except-once header on the initial (non-Inertia) visit', async () => {
    const [props] = await resolve(
      { plans: Inertia.once(() => 'value') },
      request({ 'X-Inertia-Except-Once-Props': 'plans' }),
    )

    expect(props).toEqual({ plans: 'value' })
  })

  it('emits scroll metadata and labels the wrapped array for merging', async () => {
    const paginator = {
      toJSON: () => ({ data: [{ id: 1 }], meta: {} }),
      toScrollMetadata: () => ({ pageName: 'page', previousPage: null, nextPage: 2, currentPage: 1 }),
    }
    const [props, metadata] = await resolve({ users: Inertia.scroll(() => paginator) })

    expect(props.users).toEqual({ data: [{ id: 1 }], meta: {} })
    expect(metadata.mergeProps).toEqual(['users.data'])
    expect(metadata.scrollProps).toEqual({
      users: { pageName: 'page', previousPage: null, nextPage: 2, currentPage: 1, reset: false },
    })
  })

  it('unwraps a callback that returns a prop type', async () => {
    const [props, metadata] = await resolve({ lazy: () => Inertia.defer(() => 'value') })

    expect(props).toEqual({})
    expect(metadata.deferredProps).toEqual({ default: ['lazy'] })
  })

  it('collects top-level shared prop keys and unpacks dot-notation keys', async () => {
    const [props, metadata] = await resolve(
      { 'auth.permissions': ['edit'] },
      request({ 'X-Inertia': 'true' }),
      { errors: Inertia.always({}), 'auth.user': { id: 1 } },
    )

    expect(props).toEqual({ errors: {}, auth: { user: { id: 1 }, permissions: ['edit'] } })
    expect(metadata.sharedProps).toEqual(['errors', 'auth'])
  })
})

describe('PropsResolver — partial reloads', () => {
  const pageProps = () => ({
    errors: Inertia.always({}),
    users: () => ['ada'],
    stats: () => ({ total: 1 }),
    auth: { user: { id: 1 }, permissions: () => ['edit'] },
    deferred: Inertia.defer(() => 'loaded'),
    optional: Inertia.optional(() => 'loaded'),
  })

  it('only resolves the requested props (plus always props)', async () => {
    const users = vi.fn(() => ['ada'])
    const [props] = await resolve(
      { ...pageProps(), users },
      partial('Page', { 'X-Inertia-Partial-Data': 'users,deferred,optional' }),
    )

    expect(props).toEqual({ errors: {}, users: ['ada'], deferred: 'loaded', optional: 'loaded' })
    expect(users).toHaveBeenCalledOnce()
  })

  it('excludes props listed in except, even when also in only', async () => {
    const [props] = await resolve(
      pageProps(),
      partial('Page', { 'X-Inertia-Partial-Data': 'users,stats', 'X-Inertia-Partial-Except': 'stats,errors' }),
    )

    expect(props).toEqual({ errors: {}, users: ['ada'] })
  })

  it('supports nested dot paths', async () => {
    const [props] = await resolve(pageProps(), partial('Page', { 'X-Inertia-Partial-Data': 'auth.permissions' }))

    expect(props).toEqual({ errors: {}, auth: { permissions: ['edit'] } })
  })

  it('does a full resolution when the component does not match', async () => {
    const [props, metadata] = await resolve(pageProps(), partial('Other', { 'X-Inertia-Partial-Data': 'users' }))

    expect(Object.keys(props)).toEqual(['errors', 'users', 'stats', 'auth'])
    expect(metadata.deferredProps).toEqual({ default: ['deferred'] })
  })

  it('returns reset props unlabeled and flags scroll resets', async () => {
    const paginator = {
      toJSON: () => ({ data: [] }),
      toScrollMetadata: () => ({ pageName: 'page', previousPage: null, nextPage: null, currentPage: 1 }),
    }
    const [, metadata] = await resolve(
      { feed: Inertia.merge([1]).matchOn('id'), users: Inertia.scroll(paginator) },
      partial('Page', { 'X-Inertia-Partial-Data': 'feed,users', 'X-Inertia-Reset': 'feed,users' }),
    )

    expect(metadata.mergeProps).toBeUndefined()
    expect(metadata.matchPropsOn).toBeUndefined()
    expect(metadata.scrollProps?.users.reset).toBe(true)
  })

  it('honours the infinite scroll merge intent', async () => {
    const paginator = {
      toJSON: () => ({ data: [] }),
      toScrollMetadata: () => ({ pageName: 'page', previousPage: 1, nextPage: 3, currentPage: 2 }),
    }
    const [, metadata] = await resolve(
      { users: Inertia.scroll(paginator) },
      partial('Page', { 'X-Inertia-Partial-Data': 'users', 'X-Inertia-Infinite-Scroll-Merge-Intent': 'prepend' }),
    )

    expect(metadata.prependProps).toEqual(['users.data'])
    expect(metadata.mergeProps).toBeUndefined()
  })

  it('resolves once props even when the client reports having them', async () => {
    const [props] = await resolve(
      { plans: Inertia.once(() => 'value') },
      partial('Page', { 'X-Inertia-Partial-Data': 'plans', 'X-Inertia-Except-Once-Props': 'plans' }),
    )

    expect(props).toEqual({ plans: 'value' })
  })

  it('rescues failing deferred props', async () => {
    const onRescue = vi.fn()
    const resolver = new PropsResolver(partial('Page', { 'X-Inertia-Partial-Data': 'report,other' }), 'Page', { onRescue })
    const [props, metadata] = await resolver.resolve(
      {},
      {
        report: Inertia.defer(() => Promise.reject(new Error('boom')), null, { rescue: true }),
        other: Inertia.defer(() => 'ok'),
      },
    )

    expect(props).toEqual({ other: 'ok' })
    expect(metadata.rescuedProps).toEqual(['report'])
    expect(onRescue).toHaveBeenCalledWith(expect.any(Error), 'report')
  })

  it('propagates errors from deferred props without rescue', async () => {
    await expect(
      resolve({ report: Inertia.defer(() => Promise.reject(new Error('boom'))) }, partial('Page', { 'X-Inertia-Partial-Data': 'report' })),
    ).rejects.toThrow('boom')
  })
})

describe('dot-notation props never mutate the objects they nest into', () => {
  it('leaves shared objects intact across requests', async () => {
    const app = { name: 'Demo', meta: { version: 1 } }
    const share = () => ({ app })

    const [first] = await resolve({ 'app.page': 'secret-user-42', 'app.meta.build': 7 }, request({ 'X-Inertia': 'true' }), share())
    expect(first).toEqual({ app: { name: 'Demo', page: 'secret-user-42', meta: { version: 1, build: 7 } } })
    expect(app).toEqual({ name: 'Demo', meta: { version: 1 } })

    const [second] = await resolve({}, request({ 'X-Inertia': 'true' }), share())
    expect(second).toEqual({ app: { name: 'Demo', meta: { version: 1 } } })
  })

  it('copies containers along the path in setPath', () => {
    const user = { id: 1 }
    const target: Record<string, unknown> = { auth: { user } }

    setPath(target, 'auth.user.admin', true)

    expect(target).toEqual({ auth: { user: { id: 1, admin: true } } })
    expect(user).toEqual({ id: 1 })
  })
})
