'use client'

import { useEffect, useState } from 'react'

type Phase = 'dots' | 'logo' | 'exit' | 'done'

export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('dots')

  useEffect(() => {
    const toLogo = setTimeout(() => setPhase('logo'), 550)
    const toExit = setTimeout(() => setPhase('exit'), 1200)
    const toDone = setTimeout(() => setPhase('done'), 1550)
    return () => {
      clearTimeout(toLogo)
      clearTimeout(toExit)
      clearTimeout(toDone)
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-ink transition-all duration-300 ease-in ${
        phase === 'exit' ? '-translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-splash-pop rounded-full bg-coral/40 [animation-delay:0ms]" />
        <span className="h-3 w-3 animate-splash-pop rounded-full bg-coral/60 [animation-delay:120ms]" />
        <span className="h-4 w-4 animate-splash-pop rounded-full bg-coral/80 [animation-delay:240ms]" />
        <span className="h-5 w-5 animate-splash-pop rounded-full bg-coral [animation-delay:360ms]" />
      </div>
      <p
        className={`text-sm font-semibold uppercase tracking-[0.35em] text-sand transition-opacity duration-300 ${
          phase === 'dots' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        강릉 FLOW 인사이트
      </p>
    </div>
  )
}