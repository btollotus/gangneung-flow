'use server'

import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

const XP_PER_PHOTO = 10
const MAX_XP_PHOTOS_PER_VISIT = 3

const XP_PER_EXPERIENCE_POST = 10
const MAX_XP_EXPERIENCE_POSTS_PER_DAY = 5

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

// KST 기준 "오늘 하루"(자정~다음날 자정) 범위. ranking/actions.ts의 getWeekRangeKST()와 동일한 패턴.
function getTodayRangeKST(): { start: string; end: string } {
  const nowKST = new Date(new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
  const startOfDay = new Date(nowKST)
  startOfDay.setHours(0, 0, 0, 0)
  const startOfNextDay = new Date(startOfDay)
  startOfNextDay.setDate(startOfDay.getDate() + 1)

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}T00:00:00+09:00`

  return { start: fmt(startOfDay), end: fmt(startOfNextDay) }
}

// 경험 공유 게시물 1건당 10XP, 하루(KST 기준) 최대 5건까지만 지급 (무한 도배 방지).
// auto_approved / admin_approved 두 경로 모두 이 함수를 통해서만 지급한다.
export async function grantExperiencePostXpIfEligible(
  admin: AdminClient,
  postId: string
): Promise<void> {
  const { data: post, error: postError } = await admin
    .from('experience_posts')
    .select('id, user_id, xp_earned')
    .eq('id', postId)
    .single()

  if (postError || !post) {
    console.error('경험 게시물 XP 지급용 조회 오류:', postError?.message)
    return
  }

  if (post.xp_earned && post.xp_earned > 0) {
    return
  }

  const { start, end } = getTodayRangeKST()

  const { count, error: countError } = await admin
    .from('experience_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', post.user_id)
    .gt('xp_earned', 0)
    .gte('created_at', start)
    .lt('created_at', end)

  if (countError) {
    console.error('경험 게시물 일일 XP 카운트 조회 오류:', countError.message)
    return
  }

  const alreadyGrantedToday = count ?? 0
  const xpToGrant =
    alreadyGrantedToday < MAX_XP_EXPERIENCE_POSTS_PER_DAY ? XP_PER_EXPERIENCE_POST : 0

  const { error: xpUpdateError } = await admin
    .from('experience_posts')
    .update({ xp_earned: xpToGrant })
    .eq('id', postId)

  if (xpUpdateError) {
    console.error('경험 게시물 xp_earned 업데이트 오류:', xpUpdateError.message)
    return
  }

  if (xpToGrant > 0) {
    await recalcUserTotalXp(admin, post.user_id)
  }
}

// user_scores.total_xp = visits + checkin_photos + experience_posts 세 XP원의 합.
// 이 함수 하나로만 계산해야 드리프트가 생기지 않는다 (여러 곳에서 각자 계산 금지).
export async function computeUserTotalXp(
  admin: AdminClient,
  userId: string
): Promise<number | null> {
  const [
    { data: visits, error: visitsError },
    { data: checkinPhotos, error: checkinPhotosError },
    { data: experiencePosts, error: experiencePostsError },
  ] = await Promise.all([
    admin.from('visits').select('xp_earned').eq('user_id', userId),
    admin.from('checkin_photos').select('xp_earned').eq('user_id', userId),
    admin.from('experience_posts').select('xp_earned').eq('user_id', userId),
  ])

  if (visitsError || !visits) {
    console.error('total_xp 계산용 visits 조회 오류:', visitsError?.message)
    return null
  }
  if (checkinPhotosError || !checkinPhotos) {
    console.error('total_xp 계산용 checkin_photos 조회 오류:', checkinPhotosError?.message)
    return null
  }
  if (experiencePostsError || !experiencePosts) {
    console.error('total_xp 계산용 experience_posts 조회 오류:', experiencePostsError?.message)
    return null
  }

  const visitsXp = visits.reduce((sum, v) => sum + (v.xp_earned ?? 0), 0)
  const checkinPhotosXp = checkinPhotos.reduce((sum, p) => sum + (p.xp_earned ?? 0), 0)
  const experiencePostsXp = experiencePosts.reduce((sum, p) => sum + (p.xp_earned ?? 0), 0)

  return visitsXp + checkinPhotosXp + experiencePostsXp
}

// user_scores.total_xp를 computeUserTotalXp() 결과로 갱신한다.
// 주의: 경험 공유(experience_posts)는 방문확인(visits) 없이도 올릴 수 있으므로,
// user_scores 행 자체가 아직 없는 사용자일 수 있다 — 이 경우 조용히 update가 0행 적용되어
// XP가 유실되는 것을 막기 위해 존재 여부를 먼저 확인하고 없으면 새로 만든다.
export async function recalcUserTotalXp(admin: AdminClient, userId: string): Promise<void> {
  const totalXp = await computeUserTotalXp(admin, userId)
  if (totalXp === null) return

  const { data: existing, error: existingError } = await admin
    .from('user_scores')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) {
    console.error('user_scores 존재 확인 오류:', existingError.message)
    return
  }

  if (existing) {
    // distinct_places_visited는 여기서 건드리지 않는다 — upsert/update 시 payload에 안 넣으면
    // 기존 값이 그대로 유지된다 (confirmVisit의 level 컬럼 처리와 동일한 패턴).
    const { error: updateError } = await admin
      .from('user_scores')
      .update({ total_xp: totalXp })
      .eq('user_id', userId)

    if (updateError) {
      console.error('total_xp 재계산 update 오류:', updateError.message)
    }
  } else {
    const { error: insertError } = await admin
      .from('user_scores')
      .insert({ user_id: userId, total_xp: totalXp, distinct_places_visited: 0 })

    if (insertError) {
      console.error('total_xp 재계산 insert 오류:', insertError.message)
    }
  }
}
