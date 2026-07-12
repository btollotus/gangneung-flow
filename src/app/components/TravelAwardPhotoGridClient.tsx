'use client'

import { useState } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'

type AwardPhoto = {
  content_id: string
  ko_title: string
  ko_filmst: string | null
  ko_cman_nm: string | null
  film_day: string | null
  org_image: string
  thumb_image: string
}

export default function TravelAwardPhotoGridClient({ photos }: { photos: AwardPhoto[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const selected = selectedIndex !== null ? photos[selectedIndex] : null
  const [direction, setDirection] = useState<1 | -1>(1)

  function goToPhoto(nextIndex: number, dir: 1 | -1) {
    if (nextIndex < 0 || nextIndex >= photos.length) return
    setDirection(dir)
    setSelectedIndex(nextIndex)
  }

  function handlePhotoDragEnd(_event: unknown, info: PanInfo) {
    if (selectedIndex === null) return
    const DISTANCE_THRESHOLD = 80
    const VELOCITY_THRESHOLD = 500
    if (info.offset.y < -DISTANCE_THRESHOLD || info.velocity.y < -VELOCITY_THRESHOLD) {
      goToPhoto(selectedIndex + 1, 1)
    } else if (info.offset.y > DISTANCE_THRESHOLD || info.velocity.y > VELOCITY_THRESHOLD) {
      goToPhoto(selectedIndex - 1, -1)
    }
  }

  const photoVariants = {
    enter: (dir: 1 | -1) => ({ y: dir > 0 ? 90 : -90, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (dir: 1 | -1) => ({ y: dir > 0 ? -90 : 90, opacity: 0 }),
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((photo, index) => (
          <button
            key={photo.content_id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className="overflow-hidden rounded-2xl border border-ink/10 bg-white text-left shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumb_image}
              alt={photo.ko_title}
              className="h-28 w-full object-cover sm:h-32"
            />
            <div className="p-2">
              <p className="truncate text-xs font-semibold">{photo.ko_title}</p>
              {photo.ko_filmst && (
                <p className="mt-0.5 truncate text-[10px] text-ink/50">{photo.ko_filmst}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
        className="fixed inset-0 z-[200] flex flex-col bg-black/95"
        onClick={() => setSelectedIndex(null)}
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
          <AnimatePresence custom={direction} initial={false}>
            <motion.div
              key={selected.content_id}
              custom={direction}
              variants={photoVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 170, damping: 26, mass: 0.9 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.5}
              onDragEnd={handlePhotoDragEnd}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.org_image}
                alt={selected.ko_title}
                draggable={false}
                className="max-h-full max-w-full touch-none object-contain"
              />
            </motion.div>
          </AnimatePresence>
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
