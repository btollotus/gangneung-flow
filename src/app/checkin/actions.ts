import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { moderatePhoto } from '@/lib/photoModeration'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8MB

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
  
    // 8. 강릉 마스터 뱃지 판정 — 31곳 전체 방문 시 부여
    //    badges 테이블 UNIQUE(user_id, badge_code) 제약 + ignoreDuplicates로 중복 방지
    //    이미 획득한 경우 happened_at은 최초 획득 시점 그대로 유지됨
    if (distinctPlacesVisited >= 31) {
      const { error: badgeError } = await admin.from('badges').upsert(
        { user_id: userId, badge_code: 'gangneung_master', happened_at: happenedAt },
        { onConflict: 'user_id,badge_code', ignoreDuplicates: true }
      )
  
      if (badgeError) {
        console.error('badges upsert 오류 (방문/점수 기록 자체는 성공):', badgeError.message)
      }
    }
  
    return { success: true, xpEarned }
  }

type UploadPhotoResult =
  | { success: true; photoUrl: string }
  | { success: false; error: string }

// 인증사진 업로드 — 방문확인(visits)이 이미 존재하는 장소에 대해서만 등록 가능.
// 방문확인 직후("지금 촬영")뿐 아니라 이전 세션의 방문 건에 대해서도("나중에") 동일하게 동작하도록
// visitId를 클라이언트에서 받지 않고 서버에서 본인의 최신 visits 기록을 직접 조회한다.
export async function uploadCheckinPhoto(
  placeId: string,
  formData: FormData
): Promise<UploadPhotoResult> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return { success: false, error: '로그인이 필요해요. 새로고침 후 다시 시도해주세요.' }
  }
  const userId = userData.user.id

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: '사진 파일을 선택해주세요.' }
  }
  if (!file.type.startsWith('image/')) {
    return { success: false, error: '이미지 파일만 업로드할 수 있어요.' }
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { success: false, error: '사진 용량이 너무 커요 (최대 8MB).' }
  }

  const admin = createAdminClient()

  // 본인의 해당 장소 방문 기록 중 가장 최근 것을 찾는다 (방문확인 없이는 사진 등록 불가)
  const { data: visit, error: visitError } = await admin
    .from('visits')
    .select('id')
    .eq('user_id', userId)
    .eq('place_id', placeId)
    .order('happened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (visitError) {
    console.error('사진 등록용 visit 조회 오류:', visitError.message)
    return { success: false, error: '방문 기록 확인에 실패했어요. 다시 시도해주세요.' }
  }
  if (!visit) {
    return { success: false, error: '먼저 방문확인을 완료해주세요.' }
  }

  const ext =
    file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const filePath = `${userId}/${visit.id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('checkin-photos')
    .upload(filePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('checkin-photos Storage 업로드 오류:', uploadError.message)
    return { success: false, error: '사진 업로드에 실패했어요. 다시 시도해주세요.' }
  }

  const { data: publicUrlData } = admin.storage.from('checkin-photos').getPublicUrl(filePath)
  const photoUrl = publicUrlData.publicUrl

  const { data: insertedPhoto, error: insertError } = await admin
    .from('checkin_photos')
    .insert({
      user_id: userId,
      visit_id: visit.id,
      place_id: placeId,
      photo_url: photoUrl,
    })
    .select('id')
    .single()

  if (insertError || !insertedPhoto) {
    console.error('checkin_photos insert 오류:', insertError?.message)
    return { success: false, error: '사진 정보 저장에 실패했어요. 다시 시도해주세요.' }
  }

  // 1차 자동 검수 — 결과와 무관하게 업로드 자체는 이미 성공(사용자 플로우를 막지 않음).
  // 애매하거나 검수 자체가 실패해도 auto_approved로 처리하지 않고 flagged로 fail-safe.
  try {
    const moderation = await moderatePhoto(buffer.toString('base64'), file.type)

    const { error: moderationUpdateError } = await admin
      .from('checkin_photos')
      .update({
        moderation_status: moderation.status,
        moderation_reason: moderation.reason,
        is_blurred: moderation.status !== 'auto_approved',
      })
      .eq('id', insertedPhoto.id)

    if (moderationUpdateError) {
      console.error('자동 검수 결과 저장 오류:', moderationUpdateError.message)
    }
  } catch (e) {
    console.error('자동 검수 처리 중 예외 (업로드 자체는 성공):', e instanceof Error ? e.message : e)
  }

  return { success: true, photoUrl }
}