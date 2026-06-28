'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CHECKIN_RADIUS_METERS = 200

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

type ConfirmVisitResult =
  | { success: true; xpEarned: number }
  | { success: false; error: string }

export async function confirmVisit(
  placeId: string,
  userLat: number,
  userLng: number
): Promise<ConfirmVisitResult> {
  // 1. 로그인 확인 — 쿠키 기반 세션에서 직접 조회 (클라이언트가 보낸 user_id는 신뢰하지 않음)
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return { success: false, error: '로그인이 필요해요. 새로고침 후 다시 시도해주세요.' }
  }
  const userId = userData.user.id

  const admin = createAdminClient()

  // 2. 장소 정보를 DB에서 직접 재조회 (클라이언트가 보낸 값은 신뢰하지 않음)
  const { data: place, error: placeError } = await admin
    .from('places')
    .select('id, base_xp, latitude, longitude, is_active')
    .eq('id', placeId)
    .single()

  if (placeError || !place || !place.is_active) {
    return { success: false, error: '장소 정보를 찾을 수 없어요.' }
  }

  // 3. 서버에서 거리 재검증 (클라이언트 로직 조작으로 멀리서 체크인되는 것 방지)
  const distance = haversineDistanceMeters(userLat, userLng, place.latitude, place.longitude)

  if (distance > CHECKIN_RADIUS_METERS) {
    return { success: false, error: '아직 체크인 범위 밖이에요.' }
  }

  // 4. XP 확정 (옵션 A: base_xp 그대로 지급)
  const xpEarned = place.base_xp
  const happenedAt = new Date().toISOString()

  // 5. visits insert
  const { error: visitError } = await admin.from('visits').insert({
    user_id: userId,
    place_id: placeId,
    latitude: userLat,
    longitude: userLng,
    distance_meters: distance,
    xp_earned: xpEarned,
    happened_at: happenedAt,
  })

  if (visitError) {
    console.error('visits insert 오류:', visitError.message)
    return { success: false, error: '방문 기록 저장에 실패했어요. 다시 시도해주세요.' }
  }

  // 6. place_actions insert — 실패해도 visits는 이미 저장됐으므로 로그만 남기고 진행
  const { error: actionError } = await admin.from('place_actions').insert({
    user_id: userId,
    place_id: placeId,
    action_type: 'visit_verified',
    weight: 0.6,
    happened_at: happenedAt,
  })

  if (actionError) {
    console.error('place_actions insert 오류 (방문 기록 자체는 성공):', actionError.message)
  }

  // 7. user_scores 재집계 — 누적 증가가 아니라 visits 전체를 다시 합산 (드리프트 방지)
  //    level 컬럼은 일부러 건드리지 않음 — upsert에 안 넣으면 기존 값 그대로 유지됨
  const { data: allVisits, error: visitsFetchError } = await admin
    .from('visits')
    .select('place_id, xp_earned')
    .eq('user_id', userId)

  if (visitsFetchError || !allVisits) {
    console.error('user_scores 재집계용 visits 조회 오류:', visitsFetchError?.message)
    return { success: true, xpEarned } // visits 자체는 저장됐으므로 사용자에겐 성공 처리
  }

  const totalXp = allVisits.reduce((sum, v) => sum + v.xp_earned, 0)
  const distinctPlacesVisited = new Set(allVisits.map((v) => v.place_id)).size

  const { error: scoreError } = await admin
    .from('user_scores')
    .upsert(
      { user_id: userId, total_xp: totalXp, distinct_places_visited: distinctPlacesVisited },
      { onConflict: 'user_id' }
    )

  if (scoreError) {
    console.error('user_scores upsert 오류:', scoreError.message)
  }

  return { success: true, xpEarned }
}