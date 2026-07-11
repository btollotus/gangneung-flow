'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ReportPhotoResult = { success: true } | { success: false; error: string }

export async function reportPhoto(photoId: string, reason: string): Promise<ReportPhotoResult> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return { success: false, error: '로그인이 필요해요. 새로고침 후 다시 시도해주세요.' }
  }
  const userId = userData.user.id

  const admin = createAdminClient()

  const { error: insertError } = await admin.from('photo_reports').insert({
    photo_id: photoId,
    reporter_user_id: userId,
    reason: reason || null,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: '이미 신고한 사진이에요.' }
    }
    console.error('photo_reports insert 오류:', insertError.message)
    return { success: false, error: '신고 접수에 실패했어요. 다시 시도해주세요.' }
  }

  const { error: blurError } = await admin
    .from('checkin_photos')
    .update({ is_blurred: true, moderation_status: 'flagged' })
    .eq('id', photoId)

  if (blurError) {
    console.error('checkin_photos 블러 처리 오류 (신고 접수 자체는 성공):', blurError.message)
  }

  return { success: true }
}