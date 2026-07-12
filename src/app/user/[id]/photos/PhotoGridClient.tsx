'use client'

import { useState } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import LikeButton from '@/app/components/LikeButton'
import ReportButton from '@/app/components/ReportButton'
import { useLikeState } from '@/lib/useLikeState'
import { useReportState } from '@/lib/useReportState'
import type { UserPhoto } from './actions'

/**
 * 사진방 그리드 + 라이트박스(확대) + 좋아요.
 * - 그리드 썸네일: 좋아요 하트를 우하단에 작게 표시, 탭하면 라이트박스로 확대
 * - 원본 파일이 썸네일/원본으로 나뉘어 저장되지 않아(단일 photo_url), "원본보기"는
 *   동일 이미지를 전체화면으로 크게 표시하는 것으로 처리 (홈 화면 방문사진 섹션과 동일 패턴)
 * - 좋아요 상태는 useLikeState로 이 컴포넌트에서 한 번만 관리 → 그리드 카드와 라이트박스가
 *   같은 사진에 대해 항상 같은 count/liked 값을 본다
 */
export default function PhotoGridClient({ photos }: { photos: UserPhoto[] }) {
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

    const { getState, isPending, toggle } = useLikeState(photos)
    const {
      getState: getReportState,
      isPending: isReportPending,
      submitReport,
    } = useReportState(photos.map((p) => ({ id: p.id, isBlurred: p.isBlurred })))

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
      {photos.map((photo, index) => {
          const likeState = getState(photo.id)
          const reportState = getReportState(photo.id)
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className="relative overflow-hidden rounded-lg bg-ink/5 text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 외부 Supabase Storage 공개 URL, next/image 도메인 설정 불필요 */}
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
                  onReport={() => submitReport(photo.id, '')}
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
              <p className="truncate px-1.5 py-1 text-[11px] text-ink/60">{photo.placeName}</p>
            </button>
          )
        })}
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
                key={selected.id}
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
                  src={selected.photoUrl}
                  alt={selected.placeName}
                  draggable={false}
                  className={`max-h-full max-w-full touch-none object-contain ${
                    getReportState(selected.id).isBlurred ? 'blur-md' : ''
                  }`}
                />
                {getReportState(selected.id).isBlurred && (
                  <span
                    className="absolute rounded-full bg-black/60 px-3 py-1.5 text-xs text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    신고 접수 · 검토중인 사진이에요
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div
            className="flex flex-col items-center gap-3 px-6 pb-8 pt-3 text-center text-sand"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{selected.placeName}</p>
            <div className="flex items-center gap-2">
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
          </div>
        </div>
      )}
    </>
  )
}