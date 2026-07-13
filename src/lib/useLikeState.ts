'use client'

import { useState, useTransition } from 'react'
import { toggleLike, type LikeTarget } from '@/lib/photoLikes'

export interface LikeState {
  count: number
  liked: boolean
}

/**
 * 좋아요 상태를 사진/게시물 ID 기준으로 한 곳에서 관리하는 훅.
 * - 같은 대상을 가리키는 여러 UI(그리드 카드 + 라이트박스)가 동일한 상태를 읽도록
 *   부모 컴포넌트에서 이 훅을 한 번만 호출하고, 각 LikeButton에는 count/liked/onToggle을 내려준다.
 * - 각 LikeButton이 자체 useState를 가지면 인스턴스마다 상태가 따로 놀아
 *   카드에서는 좋아요가 반영됐는데 라이트박스는 예전 값을 보여주는 문제가 생긴다 (실기기에서 확인된 버그).
 * - target 기본값은 'checkin_photo'라서 기존 호출부(체크인 사진)는 변경 없이 그대로 동작한다.
 */
export function useLikeState(
  initial: { id: string; likeCount: number; likedByMe: boolean }[],
  target: LikeTarget = 'checkin_photo'
) {
  const [stateMap, setStateMap] = useState<Map<string, LikeState>>(
    () => new Map(initial.map((p) => [p.id, { count: p.likeCount, liked: p.likedByMe }]))
  )
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const getState = (photoId: string): LikeState =>
    stateMap.get(photoId) ?? { count: 0, liked: false }

  const isPending = (photoId: string) => pendingIds.has(photoId)

  const toggle = (photoId: string) => {
    if (pendingIds.has(photoId)) return
    const current = getState(photoId)
    const optimistic: LikeState = {
      count: current.liked ? current.count - 1 : current.count + 1,
      liked: !current.liked,
    }

    setStateMap((prev) => new Map(prev).set(photoId, optimistic))
    setPendingIds((prev) => new Set(prev).add(photoId))

    startTransition(async () => {
      const result = await toggleLike(photoId, target)
      if (!result.success) {
        // 실패 시 롤백 (예: 비로그인 상태)
        setStateMap((prev) => new Map(prev).set(photoId, current))
      }
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(photoId)
        return next
      })
    })
  }

  return { getState, isPending, toggle }
}