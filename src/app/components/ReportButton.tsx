'use client'

import { useState } from 'react'

const REPORT_REASONS: { label: string; value: string }[] = [
  { label: '부적절', value: '부적절한 사진' },
  { label: '무관한 사진', value: '관련 없는 사진' },
  { label: '스팸/광고', value: '스팸/광고' },
  { label: '저작권', value: '저작권 침해' },
  { label: '기타', value: '기타' },
]

export default function ReportButton({
  reported,
  pending = false,
  onReport,
  size = 'sm',
}: {
  reported: boolean
  pending?: boolean
  onReport: (reason: string) => void
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
        className={
          isSmall
            ? 'flex w-32 flex-wrap items-center gap-1 rounded-lg bg-black/75 p-1.5 backdrop-blur-sm'
            : 'flex max-w-xs flex-wrap items-center justify-center gap-1.5 rounded-xl bg-black/75 p-2 backdrop-blur-sm'
        }
      >
        {REPORT_REASONS.map((reason) => (
          <button
            key={reason.value}
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation()
              onReport(reason.value)
              setConfirming(false)
            }}
            className={
              isSmall
                ? 'rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] text-white hover:bg-white/25'
                : 'rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white hover:bg-white/25'
            }
          >
            {reason.label}
          </button>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setConfirming(false)
          }}
          className={
            isSmall
              ? 'rounded-full px-1.5 py-0.5 text-[9px] text-white/50 hover:text-white/80'
              : 'rounded-full px-2.5 py-1 text-[11px] text-white/50 hover:text-white/80'
          }
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