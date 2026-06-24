import { createClient } from '@/lib/supabase/server'

type Tier = 'landmark' | 'underrated' | 'mission'

type Place = {
  id: string
  name: string
  tier: Tier
  category: string | null
  base_xp: number
}

const SELECT_FIELDS = 'id, name, tier, category, base_xp'

export default async function Home() {
  const supabase = await createClient()

  const [
    { data: underrated, error: underratedError },
    { data: landmarks, error: landmarkError },
    { data: missions, error: missionError },
  ] = await Promise.all([
    supabase
      .from('places')
      .select(SELECT_FIELDS)
      .eq('tier', 'underrated')
      .eq('is_active', true)
      .order('name')
      .limit(4),
    supabase
      .from('places')
      .select(SELECT_FIELDS)
      .eq('tier', 'landmark')
      .eq('is_active', true)
      .order('name')
      .limit(3),
    supabase
      .from('places')
      .select(SELECT_FIELDS)
      .eq('tier', 'mission')
      .eq('is_active', true)
      .order('name')
      .limit(1),
  ])

  if (underratedError) console.error('underrated 조회 오류:', underratedError.message)
  if (landmarkError) console.error('landmark 조회 오류:', landmarkError.message)
  if (missionError) console.error('mission 조회 오류:', missionError.message)

  const previewCount =
    (underrated?.length ?? 0) + (landmarks?.length ?? 0) + (missions?.length ?? 0)

  return (
    <main className="min-h-screen bg-[#F3ECDD] text-[#102A33]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#102A33] px-6 py-20 text-[#F3ECDD] sm:px-10">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[3px] border-dashed border-[#E2542B]/40" />
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#E2542B]">
          강릉 FLOW 인사이트
        </p>
        <h1 className="mt-4 max-w-md text-3xl font-bold leading-tight sm:text-4xl">
          도장 한 칸마다,
          <br />
          강릉의 다른 얼굴을 찍어가요
        </h1>
        <p className="mt-4 max-w-sm text-sm text-[#F3ECDD]/80">
          익숙한 명소부터 동네 골목까지 — 33곳을 채워가며 강릉을 새로 만나보세요.
        </p>
      </section>

      {/* 장소 미리보기 */}
      <section className="px-6 py-12 sm:px-10">
        <p className="mb-6 text-xs text-[#102A33]/50">33곳 중 {previewCount}곳 미리보기</p>

        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">동네 골목, 강릉지기 추천</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(underrated as Place[] | null ?? []).map((place) => (
            <PlaceCard key={place.id} place={place} variant="underrated" />
          ))}
        </div>

        <div className="mt-10 mb-4">
          <h2 className="text-sm font-semibold text-[#102A33]/60">이미 잘 알려진 명소</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(landmarks as Place[] | null ?? []).map((place) => (
            <PlaceCard key={place.id} place={place} variant="landmark" />
          ))}
        </div>

        {missions && missions.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-sm font-semibold text-[#E2542B]">특별미션</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(missions as Place[]).map((place) => (
                <PlaceCard key={place.id} place={place} variant="mission" />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="px-6 pb-16 sm:px-10">
        <button
          disabled
          aria-disabled="true"
          className="w-full cursor-not-allowed rounded-full bg-[#102A33]/10 px-6 py-4 text-sm font-semibold text-[#102A33]/40"
        >
          33곳 전체 보기 (탐색 지도 준비중)
        </button>
      </section>
    </main>
  )
}

function PlaceCard({
  place,
  variant,
}: {
  place: Place
  variant: Tier
}) {
  const styles: Record<Tier, string> = {
    landmark: 'border-[#102A33]/15 bg-white/40 text-[#102A33]/60',
    underrated: 'border-[#4F8C82]/30 bg-white text-[#102A33] shadow-sm',
    mission: 'border-2 border-dashed border-[#E2542B] bg-[#E2542B]/5 text-[#102A33]',
  }

  return (
    <div className={`rounded-2xl border p-3 ${styles[variant]}`}>
      <p className="truncate text-sm font-semibold">{place.name}</p>
      <div className="mt-1 flex items-center justify-between">
        {place.category && (
          <span className="truncate text-xs opacity-60">{place.category}</span>
        )}
        <span className="ml-auto shrink-0 text-[10px] font-bold opacity-50">
          +{place.base_xp} XP
        </span>
      </div>
    </div>
  )
}