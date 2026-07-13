'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 신고 대상 종류. 기본값을 'checkin_photo'로 둬서 기존 호출부는 target 인자 없이도 그대로 동작한다.
export type ReportTarget = 'checkin_photo' | 'experience_post'

function reportTableInfo(target: ReportTarget): {
  reportTable: string
  contentTable: string
  idColumn: string
} {
  return target === 'experience_post'
    ? { reportTable: 'experience_post_reports', contentTable: 'experience_posts', idColumn: 'post_id' }
    : { reportTable: 'photo_reports', contentTable: 'checkin_photos', idColumn: 'photo_id' }
}

export type ReportPhotoResult = { success: true } | { success: false; error: string }

export async function reportPhoto(
  photoId: string,
  reason: string,
  target: ReportTarget = 'checkin_photo'
): Promise<ReportPhotoResult> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return { success: false, error: '로그인이 필요해요. 새로고침 후 다시 시도해주세요.' }
  }
  const userId = userData.user.id

  const admin = createAdminClient()
  const { reportTable, contentTable, idColumn } = reportTableInfo(target)

  const { error: insertError } = await admin.from(reportTable).insert({
    [idColumn]: photoId,
    reporter_user_id: userId,
    reason: reason || null,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: '이미 신고한 사진이에요.' }
    }
    console.error(`${reportTable} insert 오류:`, insertError.message)
    return { success: false, error: '신고 접수에 실패했어요. 다시 시도해주세요.' }
  }

  const { error: blurError } = await admin
    .from(contentTable)
    .update({ is_blurred: true, moderation_status: 'flagged' })
    .eq('id', photoId)

  if (blurError) {
    console.error(`${contentTable} 블러 처리 오류 (신고 접수 자체는 성공):`, blurError.message)
  }

  return { success: true }
}