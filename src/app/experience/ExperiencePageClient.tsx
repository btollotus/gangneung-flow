'use client'

import { useState } from 'react'
import ExperienceUploadForm from './ExperienceUploadForm'
import type { ExperiencePost } from './page'

function formatDate(iso: string) {
  const kst = new Date(new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
  return `${kst.getMonth() + 1}/${kst.getDate()}`
}

export default function ExperiencePageClient({ initialPosts }: { initialPosts: ExperiencePost[] }) {
  const [showForm, setShowForm] = useState(false)

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
          {initialPosts.map((post) => (
            <div key={post.id} className="overflow-hidden rounded-xl bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.photoUrl}
                alt={post.placeName}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <div className="p-2">
                <p className="truncate text-xs font-semibold">{post.placeName}</p>
                {post.caption && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-ink/50">{post.caption}</p>
                )}
                <p className="mt-1 text-[10px] text-ink/30">{formatDate(post.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
