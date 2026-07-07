import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import TravelAwardPhotoGridClient from '../components/TravelAwardPhotoGridClient'

type AwardPhoto = {
  content_id: string
  ko_title: string
  ko_filmst: string | null
  ko_cman_nm: string | null
  film_day: string | null
  org_image: string
  thumb_image: string
}

export default async function TravelPhotosPage() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('travel_award_photos')
    .select('content_id, ko_title, ko_filmst, ko_cman_nm, film_day, org_image, thumb_image')
    .order('ko_title')

  if (error) {
    console.error('전국 여행 사진관 전체보기 조회 오류:', error.message)
  }

  const photos = (data as AwardPhoto[] | null) ?? []

  return (
    <main className="min-h-screen bg-sand px-6 py-8 text-ink sm:px-10">
      <Link href="/" className="text-sm text-ink/50">
        ← 홈으로
      </Link>
      <h1 className="mt-3 text-xl font-bold">📷 전국 여행 사진관 — 전체보기</h1>
      <p className="mt-1 text-xs text-ink/50">
        한국관광공사 관광공모전(사진) 수상작 {photos.length}건 · 강릉 31곳과는 별개의 콘텐츠입니다.
      </p>

      <div className="mt-6">
        <TravelAwardPhotoGridClient photos={photos} />
      </div>
    </main>
  )
}
