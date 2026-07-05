import { createClient } from '@/lib/supabase/server'
import CheckinList from './CheckinList'
import NearbyChargersSection from '../components/NearbyChargersSection'
import RefreshButton from '../components/RefreshButton'

export type CheckinPlace = {
  id: string
  name: string
  tier: 'landmark' | 'underrated' | 'mission'
  category: string | null
  base_xp: number
  latitude: number
  longitude: number
  address: string | null
}

const SELECT_FIELDS = 'id, name, tier, category, base_xp, latitude, longitude, address'

export default async function CheckinPage() {
  const supabase = await createClient()

  const { data: places, error } = await supabase
    .from('places')
    .select(SELECT_FIELDS)
    .eq('is_active', true)
    .order('name')

  if (error) console.error('places 조회 오류 (체크인):', error.message)

  return (
    <main className="min-h-screen bg-sand text-ink px-6 py-8 sm:px-10">
      <h1 className="text-lg font-bold">체크인</h1>
      <p className="mt-1 text-xs text-ink/50">
        가까운 곳부터 도장을 찍어보세요 (200m 이내에서 가능해요)
      </p>

      <div className="mt-6">
        <CheckinList places={(places as CheckinPlace[] | null) ?? []} />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">⚡ 지금 내 주변 충전소</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink/40">실시간 상태</span>
            <RefreshButton />
          </div>
        </div>
        <NearbyChargersSection />
      </section>
    </main>
  )
}