'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import LikeButton from './LikeButton'
import ReportButton from './ReportButton'
import { useLikeState } from '@/lib/useLikeState'
import { useReportState } from '@/lib/useReportState'
import type { RecentVisitPhoto } from './RecentVisitPhotoGallery'

// 방문 날짜를 KST 기준 "M/D"로 표시한다.
function formatVisitDate(createdAt: string): string {
  const kst = new Date(new Date(createdAt).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
  return `${kst.getMonth() + 1}/${kst.getDate()}`
}

export default function RecentVisitPhotoGalleryClient({
  photos,
}: {
  photos: RecentVisitPhoto[]
}) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const selected = selectedIndex !== null ? photos[selectedIndex] : null
    const touchStartY = useRef<number | null>(null)
    const isNavigatingRef = useRef(false)

    function goToPhoto(nextIndex: number) {
      if (nextIndex < 0 || nextIndex >= photos.length) return
      setSelectedIndex(nextIndex)
    }

    function handleModalTouchStart(e: React.TouchEvent) {
      touchStartY.current = e.touches[0].clientY
    }

    function handleModalTouchEnd(e: React.TouchEvent) {
      if (touchStartY.current === null || selectedIndex === null) return
      const deltaY = touchStartY.current - e.changedTouches[0].clientY
      const SWIPE_THRESHOLD = 50
      if (deltaY > SWIPE_THRESHOLD) {
        goToPhoto(selectedIndex + 1)
      } else if (deltaY < -SWIPE_THRESHOLD) {
        goToPhoto(selectedIndex - 1)
      }
      touchStartY.current = null
    }

    function handleModalWheel(e: React.WheelEvent) {
      if (selectedIndex === null || isNavigatingRef.current) return
      const WHEEL_THRESHOLD = 20
      if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return
      if (e.deltaY > 0) {
        goToPhoto(selectedIndex + 1)
      } else {
        goToPhoto(selectedIndex - 1)
      }
      isNavigatingRef.current = true
      setTimeout(() => {
        isNavigatingRef.current = false
      }, 400)
    }

    const { getState, isPending, toggle } = useLikeState(photos)
    const {
      getState: getReportState,
      isPending: isReportPending,
      submitReport,
    } = useReportState(photos.map((p) => ({ id: p.id, isBlurred: p.isBlurred })))

  return (
    <>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10">
      {photos.map((photo, index) => {
          const likeState = getState(photo.id)
          const reportState = getReportState(photo.id)
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className="relative w-40 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-white text-left shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.photoUrl}
                alt={photo.placeName}
                className={`h-28 w-full object-cover ${reportState.isBlurred ? 'blur-md' : ''}`}
              />
              {reportState.isBlurred && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
                    신고 접수 · 검토중
                  </span>
                </div>
              )}
              <div className="absolute left-1.5 top-1.5">
                <ReportButton
                  reported={reportState.reportedByMe}
                  pending={isReportPending(photo.id)}
                  onReport={() => submitReport(photo.id, '')}
                  size="sm"
                />
              </div>
              <div className="absolute right-1.5 top-1.5">
                <LikeButton
                  liked={likeState.liked}
                  count={likeState.count}
                  pending={isPending(photo.id)}
                  onToggle={() => toggle(photo.id)}
                  size="sm"
                />
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold">{photo.placeName}</p>
                <p className="mt-0.5 truncate text-[10px] text-ink/50">
                  {photo.nickname} · {formatVisitDate(photo.createdAt)}
                </p>
              </div>
            </button>
          )
        })}
        <Link
          href="/checkin-photos"
          className="flex w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-white/60 text-ink/50 shadow-sm"
        >
          <span className="text-2xl">→</span>
          <span className="text-xs font-semibold">전체보기</span>
        </Link>
      </div>

      {selected && (
        <div
        className="fixed inset-0 z-[200] flex flex-col bg-black/95"
        onClick={() => setSelectedIndex(null)}
        onTouchStart={handleModalTouchStart}
        onTouchEnd={handleModalTouchEnd}
        onWheel={handleModalWheel}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={() => setSelectedIndex(null)}
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
                onReport={() => submitReport(selected.id, '')}
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