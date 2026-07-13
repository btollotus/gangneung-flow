import { createAdminClient } from '@/lib/supabase/admin'
import ExperiencePageClient from './ExperiencePageClient'

export type ExperiencePost = {
  id: string
  photoUrl: string
  caption: string | null
  placeName: string
  address: string | null
  createdAt: string
}

// checkin_photos와 동일하게 auto_approved/admin_approved만 공개 노출한다.
async function getApprovedExperiencePosts(): Promise<ExperiencePost[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('experience_posts')
    .select('id, photo_url, caption, place_name, address, created_at, moderation_status')
    .in('moderation_status', ['auto_approved', 'admin_approved'])
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) {
    console.error('경험 게시물 조회 오류:', error.message)
    return []
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    photoUrl: p.photo_url,
    caption: p.caption,
    placeName: p.place_name,
    address: p.address,
    createdAt: p.created_at,
  }))
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
