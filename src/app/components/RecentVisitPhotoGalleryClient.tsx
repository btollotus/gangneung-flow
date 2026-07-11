'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  const [selected, setSelected] = useState<RecentVisitPhoto | null>(null)

  return (
    <>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setSelected(photo)}
            className="w-40 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-white text-left shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.photoUrl}
              alt={photo.placeName}
              className="h-28 w-full object-cover"
            />
            <div className="p-2.5">
              <p className="truncate text-xs font-semibold">{photo.placeName}</p>
              <p className="mt-0.5 truncate text-[10px] text-ink/50">
                {photo.nickname} · {formatVisitDate(photo.createdAt)}
              </p>
            </div>
          </button>
        ))}
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

          <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.photoUrl}
              alt={selected.placeName}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div
            className="px-6 pb-8 pt-3 text-center text-sand"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{selected.placeName}</p>
            <p className="mt-1 text-xs text-sand/70">{formatVisitDate(selected.createdAt)} 방문</p>
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