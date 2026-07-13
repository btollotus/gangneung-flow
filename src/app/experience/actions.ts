'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { moderatePhoto } from '@/lib/photoModeration'
import { grantExperiencePostXpIfEligible } from '@/lib/checkinPhotoXp'
import { haversineDistanceMeters, CHECKIN_RADIUS_METERS } from '@/lib/geo'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8MB

export type NearbyPlace = { id: string; name: string; distanceMeters: number }

// GPS 좌표 기준으로 31개 지정 장소 중 체크인 반경(200m) 안에 있는 가장 가까운 곳을 찾는다.
// 있으면 "여기서 찍으셨나요?" 자동 제안용으로 사용, 없으면 null 반환 (Kakao 검색으로 대체).
export async function findNearbyDesignatedPlace(
  lat: number,
  lng: number
): Promise<NearbyPlace | null> {
  const admin = createAdminClient()

  const { data: places, error } = await admin
    .from('places')
    .select('id, name, latitude, longitude')
    .eq('is_active', true)

  if (error || !places) {
    console.error('근처 지정 장소 조회 오류:', error?.message)
    return null
  }

  let closest: NearbyPlace | null = null

  for (const place of places) {
    if (place.latitude == null || place.longitude == null) continue
    const distance = haversineDistanceMeters(lat, lng, place.latitude, place.longitude)
    if (distance <= CHECKIN_RADIUS_METERS && (!closest || distance < closest.distanceMeters)) {
      closest = { id: place.id, name: place.name, distanceMeters: distance }
    }
  }

  return closest
}

export type UploadExperiencePostInput = {
  caption: string
  placeName: string
  address: string
  latitude: number | null
  longitude: number | null
  linkedPlaceId: string | null
}

// xpEarned: auto_approved로 즉시 처리된 경우에만 실제 값(0 또는 10)을 채운다.
// flagged 등 검수 대기로 넘어간 경우는 이 시점에 XP 지급 여부가 정해지지 않으므로 null(추후 지급 예정).
export type UploadExperiencePostResult =
  | { success: true; xpEarned: number | null }
  | { success: false; error: string }

export async function uploadExperiencePost(
  input: UploadExperiencePostInput,
  formData: FormData
): Promise<UploadExperiencePostResult> {
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
  if (!input.placeName.trim()) {
    return { success: false, error: '업체명(또는 장소명)을 입력해주세요.' }
  }

  const admin = createAdminClient()

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const filePath = `${userId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('experience-photos')
    .upload(filePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('experience-photos Storage 업로드 오류:', uploadError.message)
    return { success: false, error: '사진 업로드에 실패했어요. 다시 시도해주세요.' }
  }

  const { data: publicUrlData } = admin.storage.from('experience-photos').getPublicUrl(filePath)
  const photoUrl = publicUrlData.publicUrl

  const { data: insertedPost, error: insertError } = await admin
    .from('experience_posts')
    .insert({
      user_id: userId,
      photo_url: photoUrl,
      caption: input.caption.trim() || null,
      place_name: input.placeName.trim(),
      address: input.address.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
      linked_place_id: input.linkedPlaceId,
    })
    .select('id')
    .single()

  if (insertError || !insertedPost) {
    console.error('experience_posts insert 오류:', insertError?.message)
    return { success: false, error: '게시물 저장에 실패했어요. 다시 시도해주세요.' }
  }

  // 1차 자동 검수 — checkin_photos와 동일한 fail-safe 정책 (애매하면 flagged로 관리자 검수).
  let xpEarned: number | null = null
  try {
    const moderation = await moderatePhoto(buffer.toString('base64'), file.type)

    const { error: moderationUpdateError } = await admin
      .from('experience_posts')
      .update({
        moderation_status: moderation.status,
        moderation_reason: moderation.reason,
        is_blurred: moderation.status !== 'auto_approved',
      })
      .eq('id', insertedPost.id)

    if (moderationUpdateError) {
      console.error('경험 게시물 자동 검수 결과 저장 오류:', moderationUpdateError.message)
    } else if (moderation.status === 'auto_approved') {
      xpEarned = await grantExperiencePostXpIfEligible(admin, insertedPost.id)
    }
  } catch (e) {
    console.error('경험 게시물 자동 검수 처리 중 예외 (업로드 자체는 성공):', e instanceof Error ? e.message : e)
  }

  return { success: true, xpEarned }
}
