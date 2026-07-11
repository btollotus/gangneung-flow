'use client'

import { useState, useTransition } from 'react'
import { toggleLike } from '@/lib/photoLikes'

/**
 * 인증사진 좋아요 하트 버튼.
 * - optimistic update: 클릭 즉시 UI 반영, 서버 응답 실패 시 롤백
 * - 그리드 썸네일(작은 사이즈)과 라이트박스(큰 사이즈) 양쪽에서 재사용
 */
export default function LikeButton({
  photoId,
  initialCount,
  initialLiked,
  size = 'sm',
}: {
  photoId: string
  initialCount: number
  initialLiked: boolean
  size?: 'sm' | 'lg'
}) {
  const [count, setCount] = useState(initialCount)
  const [liked, setLiked] = useState(initialLiked)
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPending) return

    const prevCount = count
    const prevLiked = liked

    // optimistic update
    setLiked(!prevLiked)
    setCount(prevLiked ? prevCount - 1 : prevCount + 1)

    startTransition(async () => {
      const result = await toggleLike(photoId)
      if (!result.success) {
        // 실패 시 롤백 (예: 비로그인 상태)
        setLiked(prevLiked)
        setCount(prevCount)
      }
    })
  }

  const isSmall = size === 'sm'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={liked ? '좋아요 취소' : '좋아요'}
      className={
        isSmall
          ? 'flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-white backdrop-blur-sm'
          : 'flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sand'
      }
    >
      <span className={isSmall ? 'text-[11px] leading-none' : 'text-base leading-none'}>
        {liked ? '❤️' : '🤍'}
      </span>
      <span className={isSmall ? 'text-[10px] font-semibold leading-none' : 'text-xs font-semibold leading-none'}>
        {count}
      </span>
    </button>
  )
}