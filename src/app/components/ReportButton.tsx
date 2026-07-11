'use client'

import { useState } from 'react'

export default function ReportButton({
  reported,
  pending = false,
  onReport,
  size = 'sm',
}: {
  reported: boolean
  pending?: boolean
  onReport: () => void
  size?: 'sm' | 'lg'
}) {
  const [confirming, setConfirming] = useState(false)
  const isSmall = size === 'sm'

  if (reported) {
    return (
      <span
        className={
          isSmall
            ? 'rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm'
            : 'rounded-full bg-white/10 px-3 py-1.5 text-xs text-sand'
        }
      >
        신고 접수됨
      </span>
    )
  }

  if (confirming) {
    return (
      <span
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm"
      >
        <span className="text-[10px] text-white">신고할까요?</span>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation()
            onReport()
            setConfirming(false)
          }}
          className="text-[10px] font-semibold text-red-300"
        >
          확인
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setConfirming(false)
          }}
          className="text-[10px] text-white/60"
        >
          취소
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setConfirming(true)
      }}
      aria-label="신고"
      className={
        isSmall
          ? 'flex items-center justify-center rounded-full bg-black/40 px-1.5 py-0.5 text-white backdrop-blur-sm'
          : 'flex items-center justify-center rounded-full bg-white/10 px-3 py-1.5 text-sand'
      }
    >
      <span className={isSmall ? 'text-[11px] leading-none' : 'text-base leading-none'}>🚩</span>
    </button>
  )
}