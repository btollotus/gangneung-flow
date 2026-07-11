'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clearAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function logoutAdmin() {
  await clearAdminSession()
  redirect('/admin/login')
}

async function resolveUnresolvedReports(photoId: string, resolution: 'blocked' | 'restored') {
  const admin = createAdminClient()

  const { error } = await admin
    .from('photo_reports')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: 'admin',
      resolution,
    })
    .eq('photo_id', photoId)
    .is('resolved_at', null)

  if (error) {
    console.error('photo_reports 해결 처리 오류:', error.message)
  }
}

export async function approvePhoto(formData: FormData) {
  const photoId = formData.get('photoId')
  if (typeof photoId !== 'string' || !photoId) {
    console.error('approvePhoto: photoId 누락')
    return
  }

  const admin = createAdminClient()

  const { error: updateError } = await admin
    .from('checkin_photos')
    .update({ moderation_status: 'admin_approved', is_blurred: false })
    .eq('id', photoId)

  if (updateError) {
    console.error('checkin_photos 승인 처리 오류:', updateError.message)
    return
  }

  await resolveUnresolvedReports(photoId, 'restored')

  revalidatePath('/admin')
}

export async function blockPhoto(formData: FormData) {
  const photoId = formData.get('photoId')
  if (typeof photoId !== 'string' || !photoId) {
    console.error('blockPhoto: photoId 누락')
    return
  }

  const admin = createAdminClient()

  const { error: updateError } = await admin
    .from('checkin_photos')
    .update({ moderation_status: 'blocked', is_blurred: true })
    .eq('id', photoId)

  if (updateError) {
    console.error('checkin_photos 차단 처리 오류:', updateError.message)
    return
  }

  await resolveUnresolvedReports(photoId, 'blocked')

  revalidatePath('/admin')
}