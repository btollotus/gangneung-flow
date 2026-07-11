'use server'

import { createClient } from '@/lib/supabase/server'

export interface LikeData {
  count: number
  likedByMe: boolean
}

/**
 * 인증사진 좋아요 데이터 공용 유틸.
 * - 사진방(user/[id]/photos)과 홈 화면 방문사진 섹션(RecentVisitPhotoGallery)에서 공용으로 사용
 * - checkin_photo_likes는 authenticated 전체 SELECT 허용 → 일반(RLS) 클라이언트로 조회
 */

/**
 * 여러 사진 ID에 대한 좋아요 개수 + 현재 로그인 유저의 좋아요 여부를 배치 조회한다.
 * 비로그인 상태라면 likedByMe는 모두 false로 반환된다.
 */
export async function getLikeData(photoIds: string[]): Promise<Map<string, LikeData>> {
  const result = new Map<string, LikeData>()
  if (photoIds.length === 0) return result

  const supabase = await createClient()

  const [{ data: likesRaw, error: likesError }, { data: userData }] = await Promise.all([
    supabase.from('checkin_photo_likes').select('photo_id, user_id').in('photo_id', photoIds),
    supabase.auth.getUser(),
  ])

  if (likesError) {
    console.error('좋아요 데이터 조회 오류:', likesError.message)
  }

  const myUserId = userData?.user?.id ?? null
  const rows = (likesRaw as { photo_id: string; user_id: string }[] | null) ?? []

  for (const photoId of photoIds) {
    result.set(photoId, { count: 0, likedByMe: false })
  }

  for (const row of rows) {
    const entry = result.get(row.photo_id)
    if (!entry) continue
    entry.count += 1
    if (myUserId && row.user_id === myUserId) entry.likedByMe = true
  }

  return result
}

/**
 * 좋아요 토글(등록/취소). 로그인하지 않은 경우 실패 응답을 반환한다.
 * UNIQUE(photo_id, user_id) 제약으로 중복 등록은 DB 레벨에서도 차단된다.
 */
export async function toggleLike(
  photoId: string
): Promise<{ success: boolean; liked: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { success: false, liked: false, error: '로그인이 필요해요.' }
  }
  const userId = userData.user.id

  const { data: existing, error: selectError } = await supabase
    .from('checkin_photo_likes')
    .select('id')
    .eq('photo_id', photoId)
    .eq('user_id', userId)
    .maybeSingle()

  if (selectError) {
    console.error('좋아요 상태 확인 오류:', selectError.message)
    return { success: false, liked: false, error: '좋아요 상태 확인에 실패했어요.' }
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from('checkin_photo_likes')
      .delete()
      .eq('id', existing.id)

    if (deleteError) {
      console.error('좋아요 취소 오류:', deleteError.message)
      return { success: false, liked: true, error: '좋아요 취소에 실패했어요.' }
    }
    return { success: true, liked: false }
  }

  const { error: insertError } = await supabase
    .from('checkin_photo_likes')
    .insert({ photo_id: photoId, user_id: userId })

  if (insertError) {
    console.error('좋아요 등록 오류:', insertError.message)
    return { success: false, liked: false, error: '좋아요 등록에 실패했어요.' }
  }
  return { success: true, liked: true }
}