import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CheckinList from './CheckinList'

export type CheckinPlace = {
  id: string
  name: string
  tier: 'landmark' | 'underrated' | 'mission'
  category: string | null
  base_xp: number
  latitude: number
  longitude: number
  address: string | null
  visitorCount: number
}

const SELECT_FIELDS = 'id, name, tier, category, base_xp, latitude, longitude, address'

// 장소별 "방문확인한 고유 사용자 수"를 집계한다.
// visits 테이블은 본인 행만 SELECT 가능한 RLS가 걸려있어(ranking/actions.ts와 동일한 이유),
// 전체 사용자 집계를 위해 admin 클라이언트로 RLS를 우회해서 조회한다.
async function getVisitorCountsByPlace(): Promise<Record<string, number>> {
  const admin = createAdminClient()

  const { data: visits, error } = await admin.from('visits').select('place_id, user_id')

  if (error) {
    console.error('visits 방문자 수 집계 오류:', error.message)
    return {}
  }

  const userSetsByPlace = new Map<string, Set<string>>()
  for (const visit of visits ?? []) {
    const set = userSetsByPlace.get(visit.place_id) ?? new Set<string>()
    set.add(visit.user_id)
    userSetsByPlace.set(visit.place_id, set)
  }

  const counts: Record<string, number> = {}
  for (const [placeId, userSet] of userSetsByPlace) {
    counts[placeId] = userSet.size
  }
  return counts
}

export default async function CheckinPage() {
  const supabase = await createClient()

  const [{ data: places, error }, visitorCounts] = await Promise.all([
    supabase.from('places').select(SELECT_FIELDS).eq('is_active', true).order('name'),
    getVisitorCountsByPlace(),
  ])

  if (error) console.error('places 조회 오류 (체크인):', error.message)

  const placesWithVisitorCount: CheckinPlace[] = (places ?? []).map((place) => ({
    ...place,
    visitorCount: visitorCounts[place.id] ?? 0,
  }))

  return (
    <main className="min-h-screen bg-sand text-ink px-6 py-8 sm:px-10">
      <h1 className="text-lg font-bold">체크인</h1>
      <p className="mt-1 text-xs text-ink/50">
        가까운 곳부터 도장을 찍어보세요 (200m 이내에서 가능해요)
      </p>

      <div className="mt-6">
      <CheckinList places={placesWithVisitorCount} />
      </div>
    </main>
  )
}