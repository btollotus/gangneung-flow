import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { logoutAdmin, approvePhoto, blockPhoto, approveExperiencePost, blockExperiencePost } from './actions'

type PhotoRow = {
  id: string
  photo_url: string
  created_at: string
  user_id: string
  moderation_status: 'flagged' | 'blocked'
  moderation_reason: string | null
  places: { name: string } | { name: string }[] | null
}

type ReportRow = {
  photo_id: string
  reason: string | null
  created_at: string
}

type QueueItem = {
  id: string
  photoUrl: string
  createdAt: string
  placeName: string
  nickname: string
  moderationStatus: 'flagged' | 'blocked'
  moderationReason: string | null
  unresolvedReasons: string[]
}

const PAGE_SIZE = 20

const STATUS_LABEL: Record<'flagged' | 'blocked', string> = {
  flagged: '검수 대기',
  blocked: '차단됨',
}

const STATUS_BADGE_CLASS: Record<'flagged' | 'blocked', string> = {
  flagged: 'bg-orange-100 text-orange-700',
  blocked: 'bg-red-100 text-red-700',
}

async function getModerationQueue(): Promise<QueueItem[]> {
  const admin = createAdminClient()

  const { data: photosRaw, error: photosError } = await admin
    .from('checkin_photos')
    .select('id, photo_url, created_at, user_id, moderation_status, moderation_reason, places(name)')
    .in('moderation_status', ['flagged', 'blocked'])
    .order('created_at', { ascending: false })

  if (photosError) {
    console.error('검수 대기 사진 조회 오류:', photosError.message)
    return []
  }

  const rows = (photosRaw as PhotoRow[] | null) ?? []
  if (rows.length === 0) return []

  const photoIds = rows.map((r) => r.id)
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))

  const { data: reportsRaw, error: reportsError } = await admin
    .from('photo_reports')
    .select('photo_id, reason, created_at')
    .in('photo_id', photoIds)
    .is('resolved_at', null)

  if (reportsError) {
    console.error('미해결 신고 조회 오류:', reportsError.message)
  }

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('user_id, nickname')
    .in('user_id', userIds)

  if (profilesError) {
    console.error('검수 대기 사진 닉네임 조회 오류:', profilesError.message)
  }

  const nicknameByUserId = new Map(
    ((profiles as { user_id: string; nickname: string | null }[] | null) ?? []).map((p) => [
      p.user_id,
      p.nickname,
    ])
  )

  const reasonsByPhotoId = new Map<string, string[]>()
  ;((reportsRaw as ReportRow[] | null) ?? []).forEach((report) => {
    const list = reasonsByPhotoId.get(report.photo_id) ?? []
    if (report.reason) list.push(report.reason)
    reasonsByPhotoId.set(report.photo_id, list)
  })

  const items: QueueItem[] = rows.map((r) => {
    const place = Array.isArray(r.places) ? r.places[0] : r.places
    return {
      id: r.id,
      photoUrl: r.photo_url,
      createdAt: r.created_at,
      placeName: place?.name ?? '알 수 없는 장소',
      nickname: nicknameByUserId.get(r.user_id) ?? '익명',
      moderationStatus: r.moderation_status,
      moderationReason: r.moderation_reason,
      unresolvedReasons: reasonsByPhotoId.get(r.id) ?? [],
    }
  })

  // 신고 있는 것 우선, 그 다음 최신순 (신고 유무는 조인 테이블 값이라 JS에서 정렬)
  items.sort((a, b) => {
    const aHasReport = a.unresolvedReasons.length > 0 ? 1 : 0
    const bHasReport = b.unresolvedReasons.length > 0 ? 1 : 0
    if (aHasReport !== bHasReport) return bHasReport - aHasReport
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return items
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type ExperienceQueueItem = {
  id: string
  photoUrl: string
  createdAt: string
  placeName: string
  caption: string | null
  nickname: string
  moderationStatus: 'flagged' | 'blocked'
  moderationReason: string | null
}

async function getExperienceModerationQueue(): Promise<ExperienceQueueItem[]> {
  const admin = createAdminClient()

  const { data: postsRaw, error: postsError } = await admin
    .from('experience_posts')
    .select('id, photo_url, caption, place_name, created_at, user_id, moderation_status, moderation_reason')
    .in('moderation_status', ['flagged', 'blocked'])
    .order('created_at', { ascending: false })

  if (postsError) {
    console.error('경험 게시물 검수 대기 조회 오류:', postsError.message)
    return []
  }

  const rows = postsRaw ?? []
  if (rows.length === 0) return []

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('user_id, nickname')
    .in('user_id', userIds)

  if (profilesError) {
    console.error('경험 게시물 검수 대기 닉네임 조회 오류:', profilesError.message)
  }

  const nicknameByUserId = new Map(
    ((profiles as { user_id: string; nickname: string | null }[] | null) ?? []).map((p) => [
      p.user_id,
      p.nickname,
    ])
  )

  return rows.map((r) => ({
    id: r.id,
    photoUrl: r.photo_url,
    createdAt: r.created_at,
    placeName: r.place_name,
    caption: r.caption,
    nickname: nicknameByUserId.get(r.user_id) ?? '익명',
    moderationStatus: r.moderation_status,
    moderationReason: r.moderation_reason,
  }))
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  const currentPage = Math.max(1, Number(page) || 1)

  const allItems = await getModerationQueue()
  const experienceItems = await getExperienceModerationQueue()
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageItems = allItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">강릉FLOW 관리자</h1>
        <form action={logoutAdmin}>
          <button type="submit" className="text-xs text-ink/50 underline">
            로그아웃
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm text-ink/60">
        검수 대기 {allItems.length}건
      </p>

      {allItems.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink/40">검수 대기 중인 사진이 없어요.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {pageItems.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.photoUrl} alt={item.placeName} className="h-72 w-full object-cover" />

              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[item.moderationStatus]}`}>
                    {STATUS_LABEL[item.moderationStatus]}
                  </span>
                  {item.unresolvedReasons.length > 0 && (
                    <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-semibold text-white">
                      신고 {item.unresolvedReasons.length}건
                    </span>
                  )}
                </div>

                <div className="text-sm">
                  <p className="font-semibold">{item.placeName}</p>
                  <p className="text-ink/50">
                    {item.nickname} · {formatDate(item.createdAt)}
                  </p>
                </div>

                {item.moderationReason && (
                  <p className="rounded-lg bg-ink/5 px-3 py-2 text-xs text-ink/60">
                    Claude 검수 사유: {item.moderationReason}
                  </p>
                )}

                {item.unresolvedReasons.length > 0 && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    <p className="font-semibold">신고 사유</p>
                    <ul className="mt-1 list-disc pl-4">
                      {item.unresolvedReasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-1 flex gap-2">
                  <form action={approvePhoto} className="flex-1">
                    <input type="hidden" name="photoId" value={item.id} />
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white"
                    >
                      승인
                    </button>
                  </form>
                  <form action={blockPhoto} className="flex-1">
                    <input type="hidden" name="photoId" value={item.id} />
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white"
                    >
                      차단
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

{totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          {safePage > 1 ? (
            <Link href={`/admin?page=${safePage - 1}`} className="underline">
              이전
            </Link>
          ) : (
            <span className="text-ink/30">이전</span>
          )}
          <span className="text-ink/50">
            {safePage} / {totalPages}
          </span>
          {safePage < totalPages ? (
            <Link href={`/admin?page=${safePage + 1}`} className="underline">
              다음
            </Link>
          ) : (
            <span className="text-ink/30">다음</span>
          )}
        </div>
      )}

      <div className="mt-12 border-t border-ink/10 pt-8">
        <h2 className="text-lg font-bold">경험 공유 게시물 검수</h2>
        <p className="mt-2 text-sm text-ink/60">검수 대기 {experienceItems.length}건</p>

        {experienceItems.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink/40">검수 대기 중인 경험 게시물이 없어요.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            {experienceItems.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.photoUrl} alt={item.placeName} className="h-72 w-full object-cover" />

                <div className="flex flex-col gap-3 p-4">
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[item.moderationStatus]}`}>
                    {STATUS_LABEL[item.moderationStatus]}
                  </span>

                  <div className="text-sm">
                    <p className="font-semibold">{item.placeName}</p>
                    <p className="text-ink/50">
                      {item.nickname} · {formatDate(item.createdAt)}
                    </p>
                    {item.caption && <p className="mt-1 text-ink/70">{item.caption}</p>}
                  </div>

                  {item.moderationReason && (
                    <p className="rounded-lg bg-ink/5 px-3 py-2 text-xs text-ink/60">
                      Claude 검수 사유: {item.moderationReason}
                    </p>
                  )}

                  <div className="mt-1 flex gap-2">
                    <form action={approveExperiencePost} className="flex-1">
                      <input type="hidden" name="postId" value={item.id} />
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white"
                      >
                        승인
                      </button>
                    </form>
                    <form action={blockExperiencePost} className="flex-1">
                      <input type="hidden" name="postId" value={item.id} />
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white"
                      >
                        차단
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}