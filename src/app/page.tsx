import { createClient } from '@/lib/supabase/server'
import CctvViewer from './components/CctvViewer'
import KakaoShareButton from './components/KakaoShareButton'
import TravelAwardGallery from './components/TravelAwardGallery'
import ProgressCard from './components/ProgressCard'
import RecentVisitPhotoGallery from './components/RecentVisitPhotoGallery'
import HowItWorksSection from './components/HowItWorksSection'
import PlaceHookCard from './components/PlaceHookCard'

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
    <main className="min-h-screen bg-sand text-ink">
     {/* Hero */}
     <section className="relative overflow-hidden bg-gradient-to-br from-seafoam/25 via-seafoam/5 to-sand px-6 pt-10 pb-4 text-ink sm:px-10">
     <div className="absolute right-5 top-5 flex items-end gap-1.5 sm:right-9 sm:top-7">
          <span className="h-1.5 w-1.5 rounded-full bg-coral/25" />
          <span className="h-2 w-2 translate-y-0.5 rounded-full bg-coral/45" />
          <span className="h-2.5 w-2.5 translate-y-1 rounded-full bg-coral/70" />
          <span className="h-3.5 w-3.5 translate-y-1.5 rounded-full bg-coral" />
        </div>
        <div className="absolute right-5 top-11 sm:right-9 sm:top-14">
          <KakaoShareButton
            text="강릉 FLOW 인사이트 — 도장 한 칸마다, 강릉의 다른 얼굴을 찍어가요. 익숙한 명소부터 동네 골목까지, 31곳을 채워가며 강릉을 새로 만나보세요."
            label="카카오톡 공유"
            className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-seafoam no-underline shadow-sm"
          />
        </div>
        <h1 className="mt-3 max-w-md text-2xl font-bold leading-tight sm:text-3xl">
          도장 한 칸마다,
          <br />
          강릉의 다양한 얼굴을 찍어가요
        </h1>
        <p className="mt-3 max-w-sm text-sm text-ink/70">
          익숙한 명소부터 동네 골목까지 —
          <br />
          31곳을 채워가며 강릉을 새로 만나보세요.
        </p>
      </section>

      {/* 내 진행 현황 */}
      <section className="px-6 pt-3 sm:px-10">
        <div className="rounded-2xl border border-seafoam/30 bg-white p-5 shadow-sm">
          <PlaceHookCard />
          <div className="my-4 h-px bg-ink/10" />
          <ProgressCard />
        </div>
        </section>

<RecentVisitPhotoGallery />

{/* 이렇게 즐겨보세요 */}
      <section className="px-6 pt-8 sm:px-10">
        <h2 className="mb-3 text-sm font-semibold text-ink/60">이렇게 즐겨보세요</h2>
        <HowItWorksSection />
      </section>

      {/* 실시간 강릉 */}
      <section className="px-6 pt-10 sm:px-10">
        <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">실시간 강릉</h2>

          <span className="text-xs text-ink/40">실시간 CCTV</span>
        </div>
        <CctvViewer />
      </section>

      <TravelAwardGallery />
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
    landmark: 'border-ink/15 bg-white/40 text-ink/60',
    underrated: 'border-seafoam/30 bg-white text-ink shadow-sm',
    mission: 'border-2 border-dashed border-coral bg-coral/5 text-ink',
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
