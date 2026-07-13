'use server'

import { createClient } from '@/lib/supabase/server'

export interface LikeData {
  count: number
  likedByMe: boolean
}

// 좋아요 대상 종류. 기본값을 'checkin_photo'로 둬서 기존 호출부(체크인 사진 좋아요)는
// target 인자를 넘기지 않아도 그대로 동작한다 — 이번 일반화로 기존 코드는 변경하지 않는다.
export type LikeTarget = 'checkin_photo' | 'experience_post'

function likeTableInfo(target: LikeTarget): { table: string; idColumn: string } {
  return target === 'experience_post'
    ? { table: 'experience_post_likes', idColumn: 'post_id' }
    : { table: 'checkin_photo_likes', idColumn: 'photo_id' }
}

/**
 * 인증사진/경험 게시물 좋아요 데이터 공용 유틸.
 * - 사진방(user/[id]/photos), 홈 화면 방문사진 섹션(RecentVisitPhotoGallery),
 *   체크인 인증사진 전체보기, 경험 공유 게시물 전체보기에서 공용으로 사용
 * - checkin_photo_likes / experience_post_likes 모두 authenticated 전체 SELECT 허용 → 일반(RLS) 클라이언트로 조회
 */

/**
 * 여러 ID(사진 또는 게시물)에 대한 좋아요 개수 + 현재 로그인 유저의 좋아요 여부를 배치 조회한다.
 * 비로그인 상태라면 likedByMe는 모두 false로 반환된다.
 */
export async function getLikeData(
  ids: string[],
  target: LikeTarget = 'checkin_photo'
): Promise<Map<string, LikeData>> {
  const result = new Map<string, LikeData>()
  if (ids.length === 0) return result

  const supabase = await createClient()
  const { table, idColumn } = likeTableInfo(target)

  const [{ data: likesRaw, error: likesError }, { data: userData }] = await Promise.all([
    supabase.from(table).select(`${idColumn}, user_id`).in(idColumn, ids),
    supabase.auth.getUser(),
  ])

  if (likesError) {
    console.error('좋아요 데이터 조회 오류:', likesError.message)
  }

  const myUserId = userData?.user?.id ?? null
  const rows = (likesRaw as Record<string, string>[] | null) ?? []

  for (const id of ids) {
    result.set(id, { count: 0, likedByMe: false })
  }

  for (const row of rows) {
    const rowId = row[idColumn]
    const entry = result.get(rowId)
    if (!entry) continue
    entry.count += 1
    if (myUserId && row.user_id === myUserId) entry.likedByMe = true
  }

  return result
}

/**
 * 좋아요 토글(등록/취소). 로그인하지 않은 경우 실패 응답을 반환한다.
 * UNIQUE(id컬럼, user_id) 제약으로 중복 등록은 DB 레벨에서도 차단된다.
 */
export async function toggleLike(
  id: string,
  target: LikeTarget = 'checkin_photo'
): Promise<{ success: boolean; liked: boolean; error?: string }> {
  const supabase = await createClient()
  const { table, idColumn } = likeTableInfo(target)

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { success: false, liked: false, error: '로그인이 필요해요.' }
  }
  const userId = userData.user.id

  const { data: existing, error: selectError } = await supabase
    .from(table)
    .select('id')
    .eq(idColumn, id)
    .eq('user_id', userId)
    .maybeSingle()

  if (selectError) {
    console.error('좋아요 상태 확인 오류:', selectError.message)
    return { success: false, liked: false, error: '좋아요 상태 확인에 실패했어요.' }
  }

  if (existing) {
    const { error: deleteError } = await supabase.from(table).delete().eq('id', existing.id)

    if (deleteError) {
      console.error('좋아요 취소 오류:', deleteError.message)
      return { success: false, liked: true, error: '좋아요 취소에 실패했어요.' }
    }
    return { success: true, liked: false }
  }

  const { error: insertError } = await supabase.from(table).insert({
    [idColumn]: id,
    user_id: userId,
  })

  if (insertError) {
    console.error('좋아요 등록 오류:', insertError.message)
    return { success: false, liked: false, error: '좋아요 등록에 실패했어요.' }
  }
  return { success: true, liked: true }
}