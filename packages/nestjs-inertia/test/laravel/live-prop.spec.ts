// Ported from inertia-laravel v3.8.0 — tests/LivePropTest.php
// https://github.com/inertiajs/inertia-laravel/blob/v3.8.0/tests/LivePropTest.php
//
// Laravel's events are broadcastable classes whose channels come from
// `broadcastOn()`. Ours are a string, or a class with a static `eventName`,
// and the channel is passed explicitly: a string (public, as Laravel treats a
// bare string) or `{ name, type }` (Laravel's `PrivateChannel('orders.1')` is
// `{ name: 'orders.1', type: 'private' }`). Cases that only exist because of
// `broadcastOn()` (per-connection channels, broadcastable models, enum names)
// have no counterpart.
import { AlwaysProp, DeferProp, Inertia, LiveProp, MergeProp, OnceProp, OptionalProp, ScrollProp } from '../../src/index.js'
import { COMPONENT, fakeRequest, partialRequest, resolveProps } from './helpers.js'

const orders1 = { name: 'orders.1', type: 'private' } as const
const orders2 = { name: 'orders.2', type: 'private' } as const
const orders = { name: 'orders', type: 'public' } as const
const stats = { name: 'stats', type: 'public' } as const
const room1 = { name: 'room.1', type: 'presence' } as const

class OrderUpdated {
  static readonly eventName = 'order.updated'
}

class OrderPaid {
  static readonly eventName = 'order.paid'
}

class OrderShipped {
  static readonly eventName = 'order.shipped'
}

class OrderCreated {
  static readonly eventName = 'order.created'
}

const inertiaRequest = () => fakeRequest({ 'X-Inertia': 'true' })

/** `new LiveProp('bar', new OrderUpdated)`: Laravel reads `orders.1` (private) off the event. */
const orderUpdated = { on: OrderUpdated, channel: orders1 }

describe('LivePropTest (inertia-laravel v3.8.0)', () => {
  // ports LivePropTest::test_the_live_manifest_is_serialized_into_the_page
  it('the live manifest is serialized into the page', async () => {
    const page = await resolveProps(fakeRequest({ 'X-Inertia': 'true' }), {
      order: Inertia.live(() => 'bar', { on: OrderUpdated, channel: orders1 }),
    })

    expect(page.props.order).toBe('bar')
    expect(page.liveProps).toEqual({
      order: { listeners: [{ channel: { name: 'orders.1', type: 'private' }, events: ['order.updated'] }] },
    })
    expect(page.liveProps!.order).not.toHaveProperty('throttle')
  })

  // ports LivePropTest::test_the_live_props_key_is_omitted_when_no_props_are_live
  it('the live props key is omitted when no props are live', async () => {
    const page = await resolveProps(fakeRequest({ 'X-Inertia': 'true' }), { order: 'bar' })

    expect(page).not.toHaveProperty('liveProps')
  })

  // ports LivePropTest::test_can_invoke_with_a_value
  it('can invoke with a value', async () => {
    expect(await new LiveProp('A live prop value', orderUpdated).resolve()).toBe('A live prop value')
  })

  // ports LivePropTest::test_can_invoke_with_a_callback
  it('can invoke with a callback', async () => {
    expect(await new LiveProp(() => 'A live prop value', orderUpdated).resolve()).toBe('A live prop value')
  })

  // ports LivePropTest::test_the_factory_creates_a_live_prop
  it('the factory creates a live prop', () => {
    const liveProp = Inertia.live('bar', orderUpdated)

    expect(liveProp).toBeInstanceOf(LiveProp)
    expect(liveProp.isLive()).toBe(true)
  })

  // ports LivePropTest::test_props_are_not_live_by_default
  it('props are not live by default', () => {
    expect(new AlwaysProp('bar').isLive()).toBe(false)
    expect(new OptionalProp(() => 'bar').isLive()).toBe(false)
    expect(new OnceProp(() => 'bar').isLive()).toBe(false)
    expect(new DeferProp(() => 'bar').isLive()).toBe(false)
    expect('live' in new MergeProp('bar')).toBe(false)
    expect('live' in new ScrollProp([])).toBe(false)
  })

  // ports LivePropTest::test_supported_prop_types_can_be_marked_as_live
  it('supported prop types can be marked as live', () => {
    const props = [
      new AlwaysProp('bar'),
      new OptionalProp(() => 'bar'),
      new OnceProp(() => 'bar'),
      new DeferProp(() => 'bar'),
    ]

    for (const prop of props) {
      expect(prop.live(orderUpdated)).toBe(prop)
      expect(prop.isLive()).toBe(true)
      expect(prop.liveListeners()).toEqual([{ channel: orders1, events: ['order.updated'] }])
    }
  })

  // ports LivePropTest::test_a_merge_prop_cannot_be_made_live
  it('a merge prop cannot be made live', () => {
    const prop = new DeferProp(() => 'bar').merge()

    expect(() => prop.live(orderUpdated)).toThrow('Live updates are not supported on merge properties.')
  })

  // ports LivePropTest::test_a_live_prop_cannot_be_made_mergeable
  it('a live prop cannot be made mergeable', () => {
    const prop = new DeferProp(() => 'bar').live(orderUpdated)

    expect(() => prop.merge()).toThrow('Live updates are not supported on merge properties.')
  })

  // ports LivePropTest::test_a_deep_merge_prop_cannot_be_made_live
  it('a deep merge prop cannot be made live', () => {
    const prop = new DeferProp(() => 'bar').deepMerge()

    expect(() => prop.live(orderUpdated)).toThrow('Live updates are not supported on merge properties.')
  })

  // ports LivePropTest::test_a_live_prop_may_still_configure_how_it_would_merge
  it('a live prop may still configure how it would merge', () => {
    const prop = new DeferProp(() => 'bar').live(orderUpdated).append('items')

    expect(prop.isLive()).toBe(true)
    expect(prop.shouldMerge()).toBe(false)
  })

  // ports LivePropTest::test_the_event_class_name_is_used_as_the_event_name
  // (our classes carry their name as a static `eventName`)
  it('the static event name of an event class is used as the event name', () => {
    expect(new LiveProp('bar', orderUpdated).liveListeners()[0].events).toEqual(['order.updated'])
  })

  // ports LivePropTest::test_an_event_name_without_a_namespace_is_left_untouched
  it('an event name given as a string is left untouched', () => {
    const liveProp = new LiveProp('bar', { on: ['order.updated', 'OrderUpdated'], channel: orders1 })

    expect(liveProp.liveListeners()[0].events).toEqual(['order.updated', 'OrderUpdated'])
  })

  // ports LivePropTest::test_events_on_the_same_channel_collapse_into_one_listener
  it('events on the same channel collapse into one listener', () => {
    const liveProp = new LiveProp('bar', { on: [OrderUpdated, OrderPaid], channel: orders1 })

    expect(liveProp.liveListeners()).toEqual([{ channel: orders1, events: ['order.updated', 'order.paid'] }])
  })

  // ports LivePropTest::test_explicit_channels_pair_every_event_with_every_channel
  it('explicit channels pair every event with every channel', () => {
    const liveProp = new LiveProp('bar', { on: [OrderUpdated, 'user.updated'], channel: ['orders.1', stats] })

    expect(liveProp.liveListeners()).toEqual([
      { channel: { name: 'orders.1', type: 'public' }, events: ['order.updated', 'user.updated'] },
      { channel: stats, events: ['order.updated', 'user.updated'] },
    ])
  })

  // ports LivePropTest::test_duplicate_events_and_channels_are_removed
  it('duplicate events and channels are removed', () => {
    const liveProp = new LiveProp('bar', { on: [OrderUpdated, OrderUpdated], channel: [orders1, orders1] })

    expect(liveProp.liveListeners()).toEqual([{ channel: orders1, events: ['order.updated'] }])
  })

  // ports LivePropTest::test_the_channel_type_is_resolved_from_the_channel_class
  it('the channel type is the one given', () => {
    for (const type of ['public', 'private', 'presence', 'encrypted-private'] as const) {
      expect(new LiveProp('bar', { on: OrderUpdated, channel: { name: 'orders.1', type } }).liveListeners()).toEqual([
        { channel: { name: 'orders.1', type }, events: ['order.updated'] },
      ])
    }
  })

  // ports LivePropTest::test_a_public_channel_keeps_a_name_that_looks_prefixed
  // and LivePropTest::test_the_channel_prefix_is_never_broadcast: names are taken as given, unprefixed.
  it('a channel name is never prefixed or unprefixed', () => {
    const publicProp = new LiveProp('bar', { on: OrderUpdated, channel: { name: 'private-orders.1', type: 'public' } })
    const privateProp = new LiveProp('bar', { on: OrderUpdated, channel: orders1 })

    expect(publicProp.liveListeners()[0].channel).toEqual({ name: 'private-orders.1', type: 'public' })
    expect(privateProp.liveListeners()[0].channel).toEqual({ name: 'orders.1', type: 'private' })
  })

  // ports LivePropTest::test_a_bare_string_channel_is_public_wherever_it_is_given
  it('a bare string channel is public', () => {
    expect(new LiveProp('bar', { on: OrderUpdated, channel: 'orders' }).liveListeners()[0].channel).toEqual(orders)
  })

  // ports LivePropTest::test_can_subscribe_to_multiple_channels
  it('can subscribe to multiple channels', () => {
    const liveProp = new LiveProp('bar', { on: OrderUpdated, channel: ['orders.1', stats] })

    expect(liveProp.liveListeners()).toEqual([
      { channel: { name: 'orders.1', type: 'public' }, events: ['order.updated'] },
      { channel: stats, events: ['order.updated'] },
    ])
  })

  // ports LivePropTest::test_a_broadcast_name_without_a_channel_throws
  it('an event name without a channel throws', () => {
    const liveProp = new LiveProp('bar', { on: 'order.updated' })

    expect(() => liveProp.liveListeners()).toThrow(
      'Unable to resolve the channels for the [order.updated] event because it was given as a string. Pass the [channel] argument.',
    )
  })

  // Laravel builds a class without its payload to read `broadcastOn()`; we can't safely, so a channel is required.
  it('an event class without a channel throws', () => {
    const liveProp = new LiveProp('bar', { on: OrderUpdated })

    expect(() => liveProp.liveListeners()).toThrow(
      'Unable to resolve the channels for the [OrderUpdated] event because it was given as a class. Pass the [channel] argument.',
    )
  })

  // Counterpart of LivePropTest::test_an_event_class_name_that_does_not_exist_throws:
  // a class without a name would leave a listener that never fires.
  it('an event class without a static event name throws', () => {
    class Unnamed {}
    const liveProp = new LiveProp('bar', { on: Unnamed as never, channel: orders1 })

    expect(() => liveProp.liveListeners()).toThrow('The [Unnamed] event class does not define a static [eventName].')
  })

  // ports LivePropTest::test_a_live_prop_without_events_throws
  it('a live prop without events throws', () => {
    const liveProp = new LiveProp('bar', { on: [] })

    expect(() => liveProp.liveListeners()).toThrow(
      'A live property must listen for at least one event. Pass the event to the [on] argument.',
    )
  })

  // ports LivePropTest::test_the_throttle_is_null_by_default
  it('the throttle is null by default', () => {
    expect(new LiveProp('bar', orderUpdated).liveThrottle()).toBeNull()
  })

  // ports LivePropTest::test_can_set_the_throttle
  it('can set the throttle', () => {
    expect(Inertia.live('bar', { ...orderUpdated, throttle: 5000 }).liveThrottle()).toBe(5000)
  })

  // ports LivePropTest::test_live_can_be_called_more_than_once
  // and LivePropTest::test_events_on_different_channels_keep_their_own_listener_pairs
  it('live can be called more than once', () => {
    const prop = new LiveProp('bar', orderUpdated).live({ on: OrderShipped, channel: [stats, room1] })

    expect(prop.liveListeners()).toEqual([
      { channel: orders1, events: ['order.updated'] },
      { channel: stats, events: ['order.shipped'] },
      { channel: room1, events: ['order.shipped'] },
    ])
  })

  // ports LivePropTest::test_an_explicit_channel_does_not_leak_into_a_later_declaration
  // and LivePropTest::test_a_later_explicit_channel_does_not_leak_into_an_earlier_declaration
  it('a channel applies only to the events declared with it', () => {
    const prop = new LiveProp('bar', { on: OrderUpdated, channel: 'orders.1' }).live({ on: OrderShipped, channel: stats })

    expect(prop.liveListeners()).toEqual([
      { channel: { name: 'orders.1', type: 'public' }, events: ['order.updated'] },
      { channel: stats, events: ['order.shipped'] },
    ])
  })

  // ports LivePropTest::test_a_channel_declared_without_an_event_contributes_nothing
  it('a channel declared without an event contributes nothing', () => {
    const prop = new LiveProp('bar', orderUpdated).live({ on: [], channel: 'ignored' })

    expect(prop.liveListeners()).toEqual([{ channel: orders1, events: ['order.updated'] }])
  })

  // ports LivePropTest::test_unrelated_merge_and_live_props_can_render_together
  it('unrelated merge and live props can render together', async () => {
    const page = await resolveProps(inertiaRequest(), {
      orders: Inertia.merge(['bar']),
      metrics: Inertia.live(() => ({ count: 1 }), { on: 'order.created', channel: 'metrics' }),
    })

    expect(page.props.orders).toEqual(['bar'])
    expect(page.props.metrics).toEqual({ count: 1 })
    expect(page.mergeProps).toEqual(['orders'])
    expect(page.liveProps).toHaveProperty('metrics')
  })

  // ports LivePropTest::test_a_rescued_live_prop_does_not_re_emit_its_listeners
  it('a rescued live prop does not re-emit its listeners', async () => {
    const page = await resolveProps(partialRequest('orders'), {
      orders: Inertia.defer(
        () => {
          throw new Error('boom')
        },
        null,
        { rescue: true },
      ).live({ on: OrderCreated, channel: orders }),
    })

    expect(page.rescuedProps).toContain('orders')
    expect(page.liveProps ?? {}).not.toHaveProperty('orders')
  })

  // ports LivePropTest::test_a_live_prop_that_is_rescued_still_announces_its_listeners_on_the_initial_load
  it('a live prop that is rescued still announces its listeners on the initial load', async () => {
    const page = await resolveProps(inertiaRequest(), {
      orders: Inertia.defer(
        () => {
          throw new Error('boom')
        },
        null,
        { rescue: true },
      ).live({ on: OrderCreated, channel: orders }),
    })

    expect(page.liveProps).toHaveProperty('orders')
  })

  // ports LivePropTest::test_the_live_manifest_serializes_a_set_throttle
  it('the live manifest serializes a set throttle', async () => {
    const page = await resolveProps(inertiaRequest(), {
      order: Inertia.live(() => 'bar', { ...orderUpdated, throttle: 500 }),
    })

    expect(page.liveProps!.order).toEqual({
      listeners: [{ channel: orders1, events: ['order.updated'] }],
      throttle: 500,
    })
  })

  // ports LivePropTest::test_a_live_prop_returned_from_a_closure_is_unwrapped
  it('a live prop returned from a closure is unwrapped', async () => {
    const page = await resolveProps(inertiaRequest(), { order: () => Inertia.live('bar', orderUpdated) })

    expect(page.props.order).toBe('bar')
    expect(page.liveProps).toHaveProperty('order')
  })

  // ports LivePropTest::test_deferred_props_are_live_on_the_initial_load
  it('deferred props are live on the initial load', async () => {
    const page = await resolveProps(inertiaRequest(), {
      orders: Inertia.defer(() => ['bar']).live({ on: OrderCreated, channel: orders }),
    })

    expect(page.props).not.toHaveProperty('orders')
    expect(page.deferredProps).toEqual({ default: ['orders'] })
    expect(page.liveProps).toEqual({ orders: { listeners: [{ channel: orders, events: ['order.created'] }] } })
  })

  // ports LivePropTest::test_optional_props_are_live_on_the_initial_load
  it('optional props are live on the initial load', async () => {
    const page = await resolveProps(inertiaRequest(), { order: Inertia.optional(() => 'bar').live(orderUpdated) })

    expect(page.props).not.toHaveProperty('order')
    expect(page.liveProps).toHaveProperty('order')
  })

  // ports LivePropTest::test_always_props_are_live_on_the_initial_load
  it('always props are live on the initial load', async () => {
    const page = await resolveProps(inertiaRequest(), {
      orders: Inertia.always(() => ['bar']).live({ on: OrderCreated, channel: orders }),
    })

    expect(page.props.orders).toEqual(['bar'])
    expect(page.liveProps).toHaveProperty('orders')
  })

  // ports LivePropTest::test_deferred_live_props_can_still_append_without_merging
  it('deferred live props can still append without merging', async () => {
    const page = await resolveProps(inertiaRequest(), {
      orders: Inertia.defer(() => ({ items: ['bar'] }))
        .live({ on: OrderCreated, channel: orders })
        .append('items'),
    })

    expect(page.props).not.toHaveProperty('orders')
    expect(page.liveProps).toHaveProperty('orders')
  })

  // ports LivePropTest::test_once_props_the_client_already_loaded_are_still_live
  it('once props the client already loaded are still live', async () => {
    const page = await resolveProps(fakeRequest({ 'X-Inertia': 'true', 'X-Inertia-Except-Once-Props': 'order' }), {
      order: Inertia.once(() => 'bar').live(orderUpdated),
    })

    expect(page.props).not.toHaveProperty('order')
    expect(page.liveProps).toHaveProperty('order')
  })

  // ports LivePropTest::test_the_live_manifest_is_serialized_on_partial_requests
  it('the live manifest is serialized on partial requests', async () => {
    const page = await resolveProps(partialRequest('order'), {
      order: Inertia.live(() => 'bar', orderUpdated),
      metrics: Inertia.live(() => 'baz', { on: OrderShipped, channel: stats }),
    })

    expect(page.props).toEqual({ order: 'bar' })
    expect(Object.keys(page.liveProps!)).toEqual(['order'])
  })

  // ports LivePropTest::test_live_always_props_keep_metadata_on_unrelated_partial_requests
  it('live always props keep metadata on unrelated partial requests', async () => {
    const page = await resolveProps(partialRequest('metrics'), {
      order: Inertia.always(() => 'bar').live({ on: OrderUpdated, channel: orders2 }),
      metrics: Inertia.live(() => 'baz', { on: OrderShipped, channel: stats }),
      status: Inertia.live(() => 'ready', { on: OrderCreated, channel: orders }),
    })

    expect(page.props).toEqual({ order: 'bar', metrics: 'baz' })
    expect(page.liveProps!.order.listeners).toEqual([{ channel: orders2, events: ['order.updated'] }])
    expect(page.liveProps).toHaveProperty('metrics')
    expect(page.liveProps).not.toHaveProperty('status')
  })

  // ports LivePropTest::test_live_props_under_an_always_parent_keep_metadata_on_unrelated_partial_requests
  it('live props under an always parent keep metadata on unrelated partial requests', async () => {
    const page = await resolveProps(partialRequest('metrics'), {
      order: Inertia.always(() => ({ total: Inertia.live(() => 100, { on: OrderUpdated, channel: orders2 }) })),
      metrics: Inertia.live(() => 'baz', { on: OrderShipped, channel: stats }),
    })

    expect(page.props).toEqual({ order: { total: 100 }, metrics: 'baz' })
    expect(page.liveProps!['order.total'].listeners).toEqual([{ channel: orders2, events: ['order.updated'] }])
  })

  // ports LivePropTest::test_live_props_under_an_always_parent_keep_metadata_when_excepted
  it('live props under an always parent keep metadata when excepted', async () => {
    const page = await resolveProps(
      fakeRequest({
        'X-Inertia': 'true',
        'X-Inertia-Partial-Component': COMPONENT,
        'X-Inertia-Partial-Except': 'order',
      }),
      { order: Inertia.always(() => ({ total: Inertia.live(() => 100, orderUpdated) })) },
    )

    expect(page.props).toEqual({ order: { total: 100 } })
    expect(page.liveProps).toHaveProperty(['order.total'])
  })

  // ports LivePropTest::test_nested_live_props_are_keyed_by_their_dot_path
  it('nested live props are keyed by their dot path', async () => {
    const page = await resolveProps(inertiaRequest(), {
      order: { total: Inertia.live(() => 100, orderUpdated) },
    })

    expect(page.props).toEqual({ order: { total: 100 } })
    expect(Object.keys(page.liveProps!)).toEqual(['order.total'])
  })
})
