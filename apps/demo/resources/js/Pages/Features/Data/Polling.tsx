import { usePoll } from '@inertiajs/react'
import { useState } from 'react'
import { Badge, Code, PageHeader, Stat } from '@/Components/Demo'

interface Props {
  currentTime: string
  randomNumber: number
  favorites: number
}

export default function Polling({ currentTime, randomNumber, favorites }: Props) {
  const [polls, setPolls] = useState(0)
  const { start, stop, polling } = usePoll(2000, {
    only: ['currentTime', 'randomNumber', 'favorites'],
    onFinish: () => setPolls((count) => count + 1),
  })

  return (
    <>
      <PageHeader
        title="Polling"
        description="usePoll() performs a partial reload on an interval and stops automatically when the component unmounts. In background tabs it throttles."
        actions={
          <>
            <Badge tone={polling ? 'emerald' : 'slate'}>{polling ? 'Polling every 2s' : 'Stopped'}</Badge>
            <button type="button" className="btn-secondary" onClick={() => (polling ? stop() : start())}>
              {polling ? 'Stop' : 'Start'}
            </button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Server time" value={currentTime} />
        <Stat label="Random number" value={randomNumber} />
        <Stat label="Favorites" value={favorites} />
        <Stat label="Completed polls" value={polls} />
      </div>
      <Code>{`const { start, stop, polling } = usePoll(2000, { only: ['currentTime', 'randomNumber', 'favorites'] })`}</Code>
    </>
  )
}
