'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWeeklyRanking } from '@/app/ranking/actions'
import { generateFallbackNickname } from '@/lib/fallbackNickname'

export interface RecentVisit {
  placeId: string
  placeName: string
  happenedAt: string
}

export interface MyPageData {
    userId: string
    nickname: string
    visitedCount: number
    totalXp: number
    badgeCount: number
    weeklyRank: number | null
    recentVisits: RecentVisit[]
    isKakaoLinked: boolean
  }

interface VisitRow {
  place_id: string
  happened_at: string
  places: { name: string } | { name: string }[] | null
}

/**
 * 마이페이지에 필요한 데이터를 한 번에 조회한다.
 * - profiles/user_scores/badges/visits는 본인 행만 SELECT 가능한 RLS가 걸려있어
 *   ProgressCard.tsx, ranking/actions.ts와 동일하게 admin 클라이언트 사용
 * - 이번 주 순위는 ranking/actions.ts의 getWeeklyRanking()을 그대로 재사용 (계산 로직 이중화 방지)
 */
export async function getMyPageData(): Promise<MyPageData | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const userId = user.id
  const admin = createAdminClient()

  const [
    { data: profile, error: profileError },
    { data: score, error: scoreError },
    { count: badgeCount, error: badgeError },
    { data: recentVisitsRaw, error: visitsError },
    { myRank },
  ] = await Promise.all([
    admin.from('profiles').select('nickname').eq('user_id', userId).maybeSingle(),
    admin
      .from('user_scores')
      .select('distinct_places_visited, total_xp')
      .eq('user_id', userId)
      .maybeSingle(),
    admin.from('badges').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    admin
      .from('visits')
      .select('place_id, happened_at, places(name)')
      .eq('user_id', userId)
      .order('happened_at', { ascending: false })
      .limit(5),
    getWeeklyRanking(),
  ])

  if (profileError) console.error('마이페이지 profiles 조회 오류:', profileError.message)
  if (scoreError) console.error('마이페이지 user_scores 조회 오류:', scoreError.message)
  if (badgeError) console.error('마이페이지 badges 조회 오류:', badgeError.message)
  if (visitsError) console.error('마이페이지 visits 조회 오류:', visitsError.message)

  const recentVisits: RecentVisit[] = ((recentVisitsRaw as VisitRow[] | null) ?? []).map((v) => {
    const place = Array.isArray(v.places) ? v.places[0] : v.places
    return {
      placeId: v.place_id,
      placeName: place?.name ?? '알 수 없는 장소',
      happenedAt: v.happened_at,
    }
  })

  const isKakaoLinked = user.identities?.some((i) => i.provider === 'kakao') ?? false

  return {
    userId,
    nickname: profile?.nickname ?? generateFallbackNickname(userId),
    visitedCount: score?.distinct_places_visited ?? 0,
    totalXp: score?.total_xp ?? 0,
    badgeCount: badgeCount ?? 0,
    weeklyRank: myRank?.rank ?? null,
    recentVisits,
    isKakaoLinked,
  }
}

export type UpdateNicknameResult = { success: true } | { success: false; error: string }

/**
 * 마이페이지에서 닉네임을 직접 수정한다.
 * - 스킵으로 profiles row가 아직 없는 계정도 있으므로 upsert 사용
 *   (RLS: "본인 프로필 수정" UPDATE 정책 + "본인 프로필 생성" INSERT 정책 모두 확인됨)
 */
export async function updateNickname(newNickname: string): Promise<UpdateNicknameResult> {
  const trimmed = newNickname.trim()

  if (!trimmed) {
    return { success: false, error: '닉네임을 입력해주세요.' }
  }
  if (trimmed.length > 20) {
    return { success: false, error: '닉네임은 20자 이내로 입력해주세요.' }
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return { success: false, error: '로그인이 필요해요. 새로고침 후 다시 시도해주세요.' }
  }

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ user_id: userData.user.id, nickname: trimmed }, { onConflict: 'user_id' })

  if (upsertError) {
    if (upsertError.code === '23505') {
      return { success: false, error: '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.' }
    }
    console.error('닉네임 수정 오류:', upsertError.message)
    return { success: false, error: '저장에 실패했어요. 다시 시도해주세요.' }
  }

  return { success: true }
}