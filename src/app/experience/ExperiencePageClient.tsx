'use client'

import { useState } from 'react'
import ExperienceUploadForm from './ExperienceUploadForm'
import LikeButton from '@/app/components/LikeButton'
import ReportButton from '@/app/components/ReportButton'
import { useLikeState } from '@/lib/useLikeState'
import { useReportState } from '@/lib/useReportState'
import type { ExperiencePost } from './page'

function formatDate(iso: string) {
  const kst = new Date(new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
  return `${kst.getMonth() + 1}/${kst.getDate()}`
}

export default function ExperiencePageClient({ initialPosts }: { initialPosts: ExperiencePost[] }) {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<ExperiencePost | null>(null)

  // 경험 게시물은 checkin_photos와 별개 테이블(experience_post_likes/reports)을 쓰므로
  // 두 훅 모두 target='experience_post'를 명시한다.
  const { getState, isPending, toggle } = useLikeState(initialPosts, 'experience_post')
  const {
    getState: getReportState,
    isPending: isReportPending,
    submitReport,
  } = useReportState(
    initialPosts.map((p) => ({ id: p.id, isBlurred: p.isBlurred })),
    'experience_post'
  )

  const handleUploaded = () => {
    setShowForm(false)
    // 방금 올린 게시물의 승인 여부가 서버에서 즉시 반영되므로, 최신 리스트를 다시 받아오기 위해 리로드한다.
    window.location.reload()
  }

  return (
    <div className="flex flex-col gap-4">
      {showForm ? (
        <ExperienceUploadForm onUploaded={handleUploaded} />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full rounded-xl bg-seafoam py-2.5 text-sm font-semibold text-white"
        >
          + 경험 공유하기
        </button>
      )}

      {initialPosts.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink/40">
          아직 공유된 경험이 없어요. 첫 번째로 올려보세요!
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {initialPosts.map((post) => {
            const likeState = getState(post.id)
            const reportState = getReportState(post.id)
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelected(post)}
                className="relative overflow-hidden rounded-xl bg-ink/5 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.photoUrl}
                  alt={post.placeName}
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
                    pending={isReportPending(post.id)}
                    onReport={(reason) => submitReport(post.id, reason)}
                    size="sm"
                  />
                </div>
                <div className="absolute bottom-7 right-1">
                  <LikeButton
                    liked={likeState.liked}
                    count={likeState.count}
                    pending={isPending(post.id)}
                    onToggle={() => toggle(post.id)}
                    size="sm"
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold">{post.placeName}</p>
                  {post.caption && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-ink/50">{post.caption}</p>
                  )}
                  <p className="mt-1 text-[10px] text-ink/30">{formatDate(post.createdAt)}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

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
                신고 접수 · 검토중인 게시물이에요
              </span>
            )}
          </div>

          <div
            className="px-6 pb-8 pt-3 text-center text-sand"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">{selected.placeName}</p>
            {selected.caption && (
              <p className="mt-1 text-xs text-sand/70">{selected.caption}</p>
            )}
            <p className="mt-1 text-xs text-sand/50">
              {formatDate(selected.createdAt)} · {selected.nickname}
            </p>
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
          </div>
        </div>
      )}
    </div>
  )
}