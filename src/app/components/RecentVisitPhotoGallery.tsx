import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RecentVisitPhotoGalleryClient from './RecentVisitPhotoGalleryClient'

type PhotoRow = {
  id: string
  photo_url: string
  created_at: string
  user_id: string
  places: { name: string } | { name: string }[] | null
}

export type RecentVisitPhoto = {
  id: string
  photoUrl: string
  placeName: string
  nickname: string
  userId: string
  createdAt: string
}

const PHOTO_LIMIT = 12

/**
 * 메인 화면 "방금 다녀온 사람들" 섹션.
 * - Beautiful Korea(공모전 사진, travel_award_photos) 로직과는 완전히 분리된 별도 풀
 * - is_approved_for_home = true 인 방문 인증사진만 최신순으로 노출 (관리자가 Supabase
 *   테이블 에디터에서 수동 승인, 전용 관리자 UI는 스코프 밖 — handoff_35 확정 사항)
 * - checkin_photos는 authenticated 전체 SELECT가 이미 허용되어 있어 일반 클라이언트로 조회
 *   (권한 최소화 원칙), 다른 유저의 profiles.nickname만 RLS 우회가 필요해 admin 클라이언트 사용
 */
export default async function RecentVisitPhotoGallery() {
  const supabase = await createClient()

  const { data: photosRaw, error: photosError } = await supabase
    .from('checkin_photos')
    .select('id, photo_url, created_at, user_id, places(name)')
    .eq('is_approved_for_home', true)
    .order('created_at', { ascending: false })
    .limit(PHOTO_LIMIT)

  if (photosError) {
    console.error('방문사진 조회 오류:', photosError.message)
    return null
  }

  const rows = (photosRaw as PhotoRow[] | null) ?? []
  if (rows.length === 0) return null

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))

  const admin = createAdminClient()
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('user_id, nickname')
    .in('user_id', userIds)

  if (profilesError) console.error('방문사진 닉네임 조회 오류:', profilesError.message)

  const nicknameByUserId = new Map(
    ((profiles as { user_id: string; nickname: string | null }[] | null) ?? []).map((p) => [
      p.user_id,
      p.nickname,
    ])
  )

  const photos: RecentVisitPhoto[] = rows.map((r) => {
    const place = Array.isArray(r.places) ? r.places[0] : r.places
    return {
      id: r.id,
      photoUrl: r.photo_url,
      placeName: place?.name ?? '알 수 없는 장소',
      nickname: nicknameByUserId.get(r.user_id) ?? '익명',
      userId: r.user_id,
      createdAt: r.created_at,
    }
  })

  return (
    <section className="px-6 pt-8 sm:px-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">📸 방금 다녀온 사람들</h2>
        <span className="text-xs text-ink/40">최근 인증사진</span>
      </div>

      <RecentVisitPhotoGalleryClient photos={photos} />
    </section>
  )
}