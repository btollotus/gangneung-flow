'use client'

import { useState } from 'react'
import LikeButton from '@/app/components/LikeButton'
import { useLikeState } from '@/lib/useLikeState'
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
  const [selected, setSelected] = useState<UserPhoto | null>(null)
  const { getState, isPending, toggle } = useLikeState(photos)

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((photo) => {
          const likeState = getState(photo.id)
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelected(photo)}
              className="relative overflow-hidden rounded-lg bg-ink/5 text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 외부 Supabase Storage 공개 URL, next/image 도메인 설정 불필요 */}
              <img
                src={photo.photoUrl}
                alt={`${photo.placeName} 인증사진`}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
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
            className="flex flex-col items-center gap-3 px-6 pb-8 pt-3 text-center text-sand"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{selected.placeName}</p>
            <LikeButton
              liked={getState(selected.id).liked}
              count={getState(selected.id).count}
              pending={isPending(selected.id)}
              onToggle={() => toggle(selected.id)}
              size="lg"
            />
          </div>
        </div>
      )}
    </>
  )
}