import { createAdminClient } from '@/lib/supabase/admin'

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
        강릉 31곳과는 별개로, 전국 각지 관광공모전 수상작을 소개합니다.
      </p>

      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10">
        {photos.map((photo) => (
          <div
            key={photo.content_id}
            className="w-40 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumb_image}
              alt={photo.ko_title}
              className="h-28 w-full object-cover"
            />
            <div className="p-2.5">
              <p className="truncate text-xs font-semibold">{photo.ko_title}</p>
              {photo.ko_filmst && (
                <p className="mt-0.5 truncate text-[10px] text-ink/50">{photo.ko_filmst}</p>
              )}
              <p className="mt-1.5 text-[9px] leading-tight text-ink/35">
                {photo.film_day && `${photo.film_day.slice(0, 4)}, `}
                촬영: {photo.ko_cman_nm ?? '정보없음'}
                <br />
                한국관광공사 · 공공누리 제1유형
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
