'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UserPhoto {
  id: string
  photoUrl: string
  placeName: string
  createdAt: string
}

export interface UserPhotosResult {
  nickname: string | null
  photos: UserPhoto[]
}

interface PhotoRow {
  id: string
  photo_url: string
  created_at: string
  places: { name: string } | { name: string }[] | null
}

/**
 * 특정 유저의 사진방(인증사진 목록)을 조회한다.
 * - 닉네임은 profiles RLS(본인 행만 SELECT 허용)를 우회해야 하므로 admin 클라이언트 사용
 *   (ranking/actions.ts와 동일한 이유)
 * - checkin_photos는 checkin_photos_setup.sql에서 authenticated 전체 SELECT를 이미 허용해뒀으므로
 *   추가 권한 상승 없이 일반(RLS 적용) 클라이언트로 조회한다
 */
export async function getUserPhotos(targetUserId: string): Promise<UserPhotosResult> {
  const admin = createAdminClient()
  const supabase = await createClient()

  const [{ data: profile, error: profileError }, { data: photosRaw, error: photosError }] =
    await Promise.all([
      admin.from('profiles').select('nickname').eq('user_id', targetUserId).maybeSingle(),
      supabase
        .from('checkin_photos')
        .select('id, photo_url, created_at, places(name)')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),
    ])

  if (profileError) console.error('사진방 profiles 조회 오류:', profileError.message)
  if (photosError) console.error('사진방 checkin_photos 조회 오류:', photosError.message)

  const photos: UserPhoto[] = ((photosRaw as PhotoRow[] | null) ?? []).map((p) => {
    const place = Array.isArray(p.places) ? p.places[0] : p.places
    return {
      id: p.id,
      photoUrl: p.photo_url,
      placeName: place?.name ?? '알 수 없는 장소',
      createdAt: p.created_at,
    }
  })

  return {
    nickname: profile?.nickname ?? null,
    photos,
  }
}