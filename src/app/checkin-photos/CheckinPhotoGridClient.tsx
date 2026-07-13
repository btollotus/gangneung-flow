'use client'

import { useState } from 'react'
import Link from 'next/link'
import LikeButton from '@/app/components/LikeButton'
import ReportButton from '@/app/components/ReportButton'
import { useLikeState } from '@/lib/useLikeState'
import { useReportState } from '@/lib/useReportState'
import type { CheckinPhoto } from './page'

// 방문 날짜를 KST 기준 "M/D"로 표시한다. (RecentVisitPhotoGalleryClient.tsx와 동일 로직)
function formatVisitDate(createdAt: string): string {
  const kst = new Date(new Date(createdAt).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
  return `${kst.getMonth() + 1}/${kst.getDate()}`
}

export default function CheckinPhotoGridClient({ photos }: { photos: CheckinPhoto[] }) {
  const [selected, setSelected] = useState<CheckinPhoto | null>(null)
  const { getState, isPending, toggle } = useLikeState(photos)
  const {
    getState: getReportState,
    isPending: isReportPending,
    submitReport,
  } = useReportState(photos.map((p) => ({ id: p.id, isBlurred: p.isBlurred })))

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((photo) => {
          const likeState = getState(photo.id)
          const reportState = getReportState(photo.id)
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelected(photo)}
              className="relative overflow-hidden rounded-lg bg-ink/5 text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.photoUrl}
                alt={`${photo.placeName} 인증사진`}
                className={`aspect-square w-full object-cover ${
                  reportState.isBlurred ? 'blur-md' : ''
                }`}
                loading="lazy"
              />
              {reportState.isBlurred && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                    검토중
                  </span>
                </div>
              )}
              <div className="absolute left-1 top-1">
                <ReportButton
                  reported={reportState.reportedByMe}
                  pending={isReportPending(photo.id)}
                  onReport={(reason) => submitReport(photo.id, reason)}
                  size="sm"
                />
              </div>
              <div className="absolute bottom-7 right-1">
                <LikeButton
                  liked={likeState.liked}
                  count={likeState.count}
                  pending={isPending(photo.id)}
                  onToggle={() => toggle(photo.id)}
                  size="sm"
                />
              </div>
              <p className="truncate px-1.5 py-1 text-[11px] text-ink/60">
                {photo.placeName} · {photo.nickname}
              </p>
            </button>
          )
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/95"
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setSelected(null)}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white"
          >
            ✕
          </button>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.photoUrl}
              alt={selected.placeName}
              className={`max-h-full max-w-full object-contain ${
                getReportState(selected.id).isBlurred ? 'blur-md' : ''
              }`}
              onClick={(e) => e.stopPropagation()}
            />
            {getReportState(selected.id).isBlurred && (
              <span
                className="absolute rounded-full bg-black/60 px-3 py-1.5 text-xs text-white"
                onClick={(e) => e.stopPropagation()}
              >
                신고 접수 · 검토중인 사진이에요
              </span>
            )}
          </div>

          <div
            className="px-6 pb-8 pt-3 text-center text-sand"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{selected.placeName}</p>
            <p className="mt-1 text-xs text-sand/70">{formatVisitDate(selected.createdAt)} 방문</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <LikeButton
                liked={getState(selected.id).liked}
                count={getState(selected.id).count}
                pending={isPending(selected.id)}
                onToggle={() => toggle(selected.id)}
                size="lg"
              />
              <ReportButton
                reported={getReportState(selected.id).reportedByMe}
                pending={isReportPending(selected.id)}
                onReport={(reason) => submitReport(selected.id, reason)}
                size="lg"
              />
            </div>
            <Link
              href={`/user/${selected.userId}/photos`}
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-sand underline-offset-2 hover:underline"
            >
              {selected.nickname}님의 사진방 보기 →
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
