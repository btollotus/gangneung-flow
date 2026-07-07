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

export default async function TravelAwardGallery() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('travel_award_photos')
    .select('content_id, ko_title, ko_filmst, ko_cman_nm, film_day, org_image, thumb_image')
    .order('content_id')
    .limit(12)

  if (error) {
    console.error('전국 여행 사진관 조회 오류:', error.message)
    return null
  }

  const photos = (data as AwardPhoto[] | null) ?? []

  if (photos.length === 0) return null

  return (
    <section className="px-6 pt-10 sm:px-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">📷 전국 여행 사진관</h2>
        <span className="text-xs text-ink/40">관광공모전 수상작</span>
      </div>
      <p className="mb-4 text-xs text-ink/50">
    
      </p>

      <TravelAwardGalleryClient photos={photos} />
    </section>
  )
}
