'use client'

import { useState } from 'react'

type AwardPhoto = {
  content_id: string
  ko_title: string
  ko_filmst: string | null
  ko_cman_nm: string | null
  film_day: string | null
  org_image: string
  thumb_image: string
}

export default function TravelAwardGalleryClient({ photos }: { photos: AwardPhoto[] }) {
  const [selected, setSelected] = useState<AwardPhoto | null>(null)

  return (
    <>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10">
        {photos.map((photo) => (
          <button
            key={photo.content_id}
            type="button"
            onClick={() => setSelected(photo)}
            className="w-40 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-white text-left shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumb_image}
              alt={photo.ko_title}
              className="h-28 w-full object-cover"
            />
            <div className="p-2.5">
              <p className="truncate text-xs font-semibold">{photo.ko_title}</p>
              {photo.ko_filmst && (
                <p className="mt-0.5 truncate text-[10px] text-ink/50">{photo.ko_filmst}</p>
              )}
              <p className="mt-1.5 text-[9px] leading-tight text-ink/35">
                {photo.film_day && `${photo.film_day.slice(0, 4)}, `}
                촬영: {photo.ko_cman_nm ?? '정보없음'}
                <br />
                한국관광공사 · 공공누리 제1유형
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
              src={selected.org_image}
              alt={selected.ko_title}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div
            className="px-6 pb-8 pt-3 text-center text-sand"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{selected.ko_title}</p>
            {selected.ko_filmst && (
              <p className="mt-1 text-xs text-sand/70">{selected.ko_filmst}</p>
            )}
            <p className="mt-2 text-[10px] text-sand/50">
              {selected.film_day && `${selected.film_day.slice(0, 4)}, `}
              촬영: {selected.ko_cman_nm ?? '정보없음'} · 한국관광공사 관광공모전 수상작 · 공공누리 제1유형
            </p>
          </div>
        </div>
      )}
    </>
  )
}
