'use client'

import { useState, useTransition } from 'react'
import { reportPhoto, type ReportTarget } from '@/lib/photoReports'

export interface ReportState {
  isBlurred: boolean
  reportedByMe: boolean
}

// target 기본값은 'checkin_photo'라서 기존 호출부(체크인 사진)는 변경 없이 그대로 동작한다.
export function useReportState(
  initial: { id: string; isBlurred: boolean }[],
  target: ReportTarget = 'checkin_photo'
) {
  const [stateMap, setStateMap] = useState<Map<string, ReportState>>(
    () => new Map(initial.map((p) => [p.id, { isBlurred: p.isBlurred, reportedByMe: false }]))
  )
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [errorByPhotoId, setErrorByPhotoId] = useState<Map<string, string>>(new Map())
  const [, startTransition] = useTransition()

  const getState = (photoId: string): ReportState =>
    stateMap.get(photoId) ?? { isBlurred: false, reportedByMe: false }

  const isPending = (photoId: string) => pendingIds.has(photoId)
  const getError = (photoId: string) => errorByPhotoId.get(photoId)

  const submitReport = (photoId: string, reason: string) => {
    if (pendingIds.has(photoId)) return

    setPendingIds((prev) => new Set(prev).add(photoId))
    setErrorByPhotoId((prev) => {
      const next = new Map(prev)
      next.delete(photoId)
      return next
    })

    startTransition(async () => {
      const result = await reportPhoto(photoId, reason, target)

      if (result.success) {
        setStateMap((prev) => new Map(prev).set(photoId, { isBlurred: true, reportedByMe: true }))
      } else {
        setErrorByPhotoId((prev) => new Map(prev).set(photoId, result.error))
      }

      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(photoId)
        return next
      })
    })
  }

  return { getState, isPending, getError, submitReport }
}