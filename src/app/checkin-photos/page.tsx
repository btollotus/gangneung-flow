import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLikeData } from '@/lib/photoLikes'
import CheckinPhotoGridClient from './CheckinPhotoGridClient'

export type CheckinPhoto = {
  id: string
  photoUrl: string
  placeName: string
  nickname: string
  userId: string
  createdAt: string
  likeCount: number
  likedByMe: boolean
  isBlurred: boolean
}

type PhotoRow = {
  id: string
  photo_url: string
  created_at: string
  user_id: string
  is_blurred: boolean
  places: { name: string } | { name: string }[] | null
}

/**
 * 체크인 인증사진 전체보기 페이지.
 * - 홈 화면 "방금 다녀온 사람들" 캐러셀(RecentVisitPhotoGallery, 12장 제한)의 전체 목록 버전
 * - 조회 조건(is_approved_for_home = true, moderation_status != blocked)은 홈 화면과 동일하게 유지
 */
export default async function CheckinPhotosPage() {
  const supabase = await createClient()

  const { data: photosRaw, error: photosError } = await supabase
    .from('checkin_photos')
    .select('id, photo_url, created_at, user_id, is_blurred, places(name)')
    .eq('is_approved_for_home', true)
    .neq('moderation_status', 'blocked')
    .order('created_at', { ascending: false })

  if (photosError) {
    console.error('체크인 인증사진 전체보기 조회 오류:', photosError.message)
  }

  const rows = (photosRaw as PhotoRow[] | null) ?? []

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))

  const admin = createAdminClient()
  const { data: profiles, error: profilesError } =
    userIds.length > 0
      ? await admin.from('profiles').select('user_id, nickname').in('user_id', userIds)
      : { data: [], error: null }

  if (profilesError) console.error('체크인 인증사진 닉네임 조회 오류:', profilesError.message)

  const nicknameByUserId = new Map(
    ((profiles as { user_id: string; nickname: string | null }[] | null) ?? []).map((p) => [
      p.user_id,
      p.nickname,
    ])
  )

  const likeDataByPhotoId = await getLikeData(rows.map((r) => r.id))

  const photos: CheckinPhoto[] = rows.map((r) => {
    const place = Array.isArray(r.places) ? r.places[0] : r.places
    const likeData = likeDataByPhotoId.get(r.id)
    return {
      id: r.id,
      photoUrl: r.photo_url,
      placeName: place?.name ?? '알 수 없는 장소',
      nickname: nicknameByUserId.get(r.user_id) ?? '익명',
      userId: r.user_id,
      createdAt: r.created_at,
      likeCount: likeData?.count ?? 0,
      likedByMe: likeData?.likedByMe ?? false,
      isBlurred: r.is_blurred,
    }
  })

  return (
    <main className="min-h-screen bg-sand px-6 py-8 text-ink sm:px-10">
      <Link href="/" className="text-sm text-ink/50">
        ← 홈으로
      </Link>
      <h1 className="mt-3 text-xl font-bold">📸 방금 다녀온 사람들 전체보기</h1>
      <p className="mt-1 text-xs text-ink/50">최근 인증사진 {photos.length}장</p>

      <div className="mt-6">
        {photos.length === 0 ? (
          <p className="text-center text-sm text-ink/40">아직 등록된 인증사진이 없어요.</p>
        ) : (
          <CheckinPhotoGridClient photos={photos} />
        )}
      </div>
    </main>
  )
}
