'use client'

import { useEffect, useState } from 'react'

type Phase = 'dots' | 'logo' | 'exit' | 'done'

interface AwardPhoto {
  url: string
  title: string
  photographer: string
  filmDay: string // YYYYMM
}

interface SplashScreenProps {
  backgroundPhoto?: AwardPhoto | null
}

export default function SplashScreen({ backgroundPhoto = null }: SplashScreenProps) {
  const [phase, setPhase] = useState<Phase>('dots')

  useEffect(() => {
    const toLogo = setTimeout(() => setPhase('logo'), 550)
    const toExit = setTimeout(() => setPhase('exit'), 2150)
    const toDone = setTimeout(() => setPhase('done'), 2500)
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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 overflow-hidden bg-ink transition-all duration-300 ease-in ${
        phase === 'exit' ? '-translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      {backgroundPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundPhoto.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/20 to-ink/60" />

      <div className="relative z-10 flex items-center gap-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
        <span className="h-2 w-2 animate-splash-pop rounded-full bg-coral/40 [animation-delay:0ms]" />
        <span className="h-3 w-3 animate-splash-pop rounded-full bg-coral/60 [animation-delay:120ms]" />
        <span className="h-4 w-4 animate-splash-pop rounded-full bg-coral/80 [animation-delay:240ms]" />
        <span className="h-5 w-5 animate-splash-pop rounded-full bg-coral [animation-delay:360ms]" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bogo-logo-light.png"
        alt="보고"
        className={`relative z-10 w-40 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] transition-opacity duration-300 sm:w-48 ${
          phase === 'dots' ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <p
        className={`relative z-10 text-sm font-semibold uppercase tracking-[0.35em] text-sand drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] transition-opacity duration-300 ${
          phase === 'dots' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        보고
      </p>

      {backgroundPhoto && (
        <p
          className={`absolute bottom-3 right-3 z-10 max-w-[80%] text-right text-[10px] leading-tight text-sand/70 transition-opacity duration-300 ${
            phase === 'dots' ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {backgroundPhoto.title} ({backgroundPhoto.filmDay.slice(0, 4)}, 촬영: {backgroundPhoto.photographer}) · 한국관광공사 관광공모전 수상작 · 공공누리 제1유형
        </p>
      )}
    </div>
  )
}