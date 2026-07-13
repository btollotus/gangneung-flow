'use server'

import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

const XP_PER_PHOTO = 10
const MAX_XP_PHOTOS_PER_VISIT = 3

// 사진 1장당 10XP, 같은 visit_id당 최대 3장까지만 지급.
// auto_approved(업로드 즉시 자동승인) / admin_approved(관리자 수동승인) 두 경로 모두
// 반드시 이 함수를 통해서만 XP를 지급한다 (중복 지급/합산 공식 불일치 방지).
export async function grantCheckinPhotoXpIfEligible(
  admin: AdminClient,
  photoId: string
): Promise<void> {
  const { data: photo, error: photoError } = await admin
    .from('checkin_photos')
    .select('id, user_id, visit_id, xp_earned')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) {
    console.error('사진 XP 지급용 조회 오류:', photoError?.message)
    return
  }

  // 이미 XP가 지급된 사진이면 중복 지급 방지 (재승인 등으로 재호출되는 경우 대비)
  if (photo.xp_earned && photo.xp_earned > 0) {
    return
  }

  const { count, error: countError } = await admin
    .from('checkin_photos')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', photo.visit_id)
    .gt('xp_earned', 0)

  if (countError) {
    console.error('사진 XP 카운트 조회 오류:', countError.message)
    return
  }

  const alreadyGrantedCount = count ?? 0
  const xpToGrant = alreadyGrantedCount < MAX_XP_PHOTOS_PER_VISIT ? XP_PER_PHOTO : 0

  const { error: xpUpdateError } = await admin
    .from('checkin_photos')
    .update({ xp_earned: xpToGrant })
    .eq('id', photoId)

  if (xpUpdateError) {
    console.error('사진 xp_earned 업데이트 오류:', xpUpdateError.message)
    return
  }

  if (xpToGrant > 0) {
    await recalcUserTotalXp(admin, photo.user_id)
  }
}

// user_scores.total_xp = visits.xp_earned 합 + checkin_photos.xp_earned 합.
// confirmVisit()의 재집계 로직과 동일한 공식을 유지해야 드리프트가 생기지 않는다.
export async function recalcUserTotalXp(admin: AdminClient, userId: string): Promise<void> {
  const [{ data: visits, error: visitsError }, { data: photos, error: photosError }] =
    await Promise.all([
      admin.from('visits').select('xp_earned').eq('user_id', userId),
      admin.from('checkin_photos').select('xp_earned').eq('user_id', userId),
    ])

  if (visitsError || !visits) {
    console.error('total_xp 재계산용 visits 조회 오류:', visitsError?.message)
    return
  }
  if (photosError || !photos) {
    console.error('total_xp 재계산용 checkin_photos 조회 오류:', photosError?.message)
    return
  }

  const visitsXp = visits.reduce((sum, v) => sum + (v.xp_earned ?? 0), 0)
  const photosXp = photos.reduce((sum, p) => sum + (p.xp_earned ?? 0), 0)

  // 이 시점에는 user_scores 행이 이미 존재한다고 가정한다.
  // (checkin_photos는 방문확인(visits)이 선행되어야 생성되고, confirmVisit이 최초 방문 때 upsert로 행을 만들어둔다.)
  const { error: updateError } = await admin
    .from('user_scores')
    .update({ total_xp: visitsXp + photosXp })
    .eq('user_id', userId)

  if (updateError) {
    console.error('total_xp 재계산 update 오류:', updateError.message)
  }
}