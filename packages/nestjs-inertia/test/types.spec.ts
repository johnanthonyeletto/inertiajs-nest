import type { InertiaContext } from '../src/context.js'
import { props as Inertia } from '../src/props.js'

declare module '../src/types.js' {
  interface InertiaPages {
    'Typed/Show': { user: { name: string }; stats: { visits: number } }
  }
}

// Type-level checks: `npm run typecheck` fails if `render()` stops checking
// the props of components listed in `InertiaPages`.
function typedRender(inertia: InertiaContext) {
  inertia.render('Typed/Show', { user: { name: 'Ada' }, stats: Inertia.defer(() => ({ visits: 1 })) })
  inertia.render('Typed/Show', { user: async () => ({ name: 'Ada' }), stats: { visits: 1 } })

  // @ts-expect-error a required prop is missing
  inertia.render('Typed/Show', { user: { name: 'Ada' } })

  // @ts-expect-error a prop has the wrong type
  inertia.render('Typed/Show', { user: { name: 1 }, stats: { visits: 1 } })

  // Components that aren't listed accept any props.
  inertia.render('Untyped/Page', { anything: true })
}

it('types render() props from InertiaPages (checked by tsc)', () => {
  expect(typedRender).toBeTypeOf('function')
})
