import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TOTAL_PLACES = 31

export default async function ProgressCard() {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  // 로그인 실패(익명 세션 생성 전 등) 시에도 홈 화면 자체는 계속 보여야 하므로 카드만 0으로 표시
  if (userError || !userData.user) {
    return <ProgressCardView visited={0} totalXp={0} badgeCount={0} />
  }

  const userId = userData.user.id
  const admin = createAdminClient()

  // visits/user_scores/badges는 본인 행만 SELECT 가능한 RLS가 걸려있어 admin 클라이언트 사용
  const { data: score, error: scoreError } = await admin
    .from('user_scores')
    .select('distinct_places_visited, total_xp')
    .eq('user_id', userId)
    .maybeSingle()

  if (scoreError) {
    console.error('진행현황 카드 user_scores 조회 오류:', scoreError.message)
  }

  const { count: badgeCount, error: badgeError } = await admin
    .from('badges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (badgeError) {
    console.error('진행현황 카드 badges 조회 오류:', badgeError.message)
  }

  return (
    <ProgressCardView
      visited={score?.distinct_places_visited ?? 0}
      totalXp={score?.total_xp ?? 0}
      badgeCount={badgeCount ?? 0}
    />
  )
}

function ProgressCardView({
  visited,
  totalXp,
  badgeCount,
}: {
  visited: number
  totalXp: number
  badgeCount: number
}) {
  const percent = Math.min(100, Math.round((visited / TOTAL_PLACES) * 100))

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-ink">내 진행 현황</p>
        <p className="text-xs text-ink/50">{totalXp} XP</p>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <p className="text-2xl font-bold text-ink">
          {visited}
          <span className="text-base font-medium text-ink/40"> / {TOTAL_PLACES}곳</span>
        </p>
        {badgeCount > 0 && (
          <p className="text-xs font-medium text-coral">🎖️ 뱃지 {badgeCount}개</p>
        )}
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-seafoam transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <Link
        href="/checkin"
        className="mt-4 block rounded-full bg-coral px-6 py-3 text-center text-sm font-semibold text-white"
      >
        {visited === 0 ? '첫 체크인하러 가기' : '체크인 이어서 하기'}
      </Link>
    </div>
  )
}