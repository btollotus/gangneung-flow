import { createAdminClient } from '@/lib/supabase/admin'
import { getLikeData } from '@/lib/photoLikes'
import ExperiencePageClient from './ExperiencePageClient'

export type ExperiencePost = {
  id: string
  photoUrl: string
  caption: string | null
  placeName: string
  address: string | null
  createdAt: string
  userId: string
  nickname: string
  isBlurred: boolean
  likeCount: number
  likedByMe: boolean
}

// checkin_photos와 동일하게 auto_approved/admin_approved만 공개 노출한다.
async function getApprovedExperiencePosts(): Promise<ExperiencePost[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('experience_posts')
    .select(
      'id, photo_url, caption, place_name, address, created_at, moderation_status, user_id, is_blurred'
    )
    .in('moderation_status', ['auto_approved', 'admin_approved'])
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) {
    console.error('경험 게시물 조회 오류:', error.message)
    return []
  }

  const rows = data ?? []
  const userIds = Array.from(new Set(rows.map((p) => p.user_id)))

  const { data: profiles, error: profilesError } =
    userIds.length > 0
      ? await admin.from('profiles').select('user_id, nickname').in('user_id', userIds)
      : { data: [], error: null }

  if (profilesError) console.error('경험 게시물 닉네임 조회 오류:', profilesError.message)

  const nicknameByUserId = new Map(
    ((profiles as { user_id: string; nickname: string | null }[] | null) ?? []).map((p) => [
      p.user_id,
      p.nickname,
    ])
  )

  // 경험 게시물은 checkin_photos와 별개 좋아요 테이블(experience_post_likes)을 쓰므로
  // target을 명시해서 조회한다 (기본값은 'checkin_photo'라서 여기선 반드시 넘겨야 함).
  const likeDataByPostId = await getLikeData(
    rows.map((p) => p.id),
    'experience_post'
  )

  return rows.map((p) => {
    const likeData = likeDataByPostId.get(p.id)
    return {
      id: p.id,
      photoUrl: p.photo_url,
      caption: p.caption,
      placeName: p.place_name,
      address: p.address,
      createdAt: p.created_at,
      userId: p.user_id,
      nickname: nicknameByUserId.get(p.user_id) ?? '익명',
      isBlurred: p.is_blurred,
      likeCount: likeData?.count ?? 0,
      likedByMe: likeData?.likedByMe ?? false,
    }
  })
}

export default async function ExperiencePage() {
  const posts = await getApprovedExperiencePosts()

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-lg font-bold">경험 공유</h1>
      <p className="mt-1 text-sm text-ink/50">강릉에서 발견한 맛집·카페·순간을 공유해보세요</p>
      <div className="mt-4">
        <ExperiencePageClient initialPosts={posts} />
      </div>
    </div>
  )
}