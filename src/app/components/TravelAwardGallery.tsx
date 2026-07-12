import { createAdminClient } from '@/lib/supabase/admin'
import TravelAwardGalleryClient from './TravelAwardGalleryClient'

type AwardPhoto = {
  content_id: string
  ko_title: string
  ko_filmst: string | null
  ko_cman_nm: string | null
  film_day: string | null
  org_image: string
  thumb_image: string
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export default async function TravelAwardGallery() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('travel_award_photos')
    .select('content_id, ko_title, ko_filmst, ko_cman_nm, film_day, org_image, thumb_image')

  if (error) {
    console.error('Beautiful Korea!! 조회 오류:', error.message)
    return null
  }

  const allPhotos = (data as AwardPhoto[] | null) ?? []

  if (allPhotos.length === 0) return null

  // 매번 새로고침마다 랜덤 12장만 홈 화면에 노출 (전체는 /travel-photos에서 확인)
  const photos = shuffle(allPhotos).slice(0, 12)

  return (
    <section className="px-6 pt-10 sm:px-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">📷 Beautiful Korea!!</h2>
        <span className="text-xs text-ink/40">관광공모전 수상작</span>
      </div>
      <p className="mb-4 text-xs text-ink/50">
        
      </p>

      <TravelAwardGalleryClient photos={photos} />
    </section>
  )
}
