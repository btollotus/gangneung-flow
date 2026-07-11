import { getUserPhotos } from './actions'

export default async function UserPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { nickname, photos } = await getUserPhotos(id)

  if (nickname === null) {
    return (
      <div className="px-4 py-6 pb-24 text-center text-sm text-ink/60">
        사용자를 찾을 수 없어요.
      </div>
    )
  }

  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="mb-4 text-lg font-bold text-ink">{nickname}님의 사진방</h1>

      {photos.length === 0 ? (
        <p className="text-center text-sm text-ink/40">아직 등록된 인증사진이 없어요.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-lg bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- 외부 Supabase Storage 공개 URL, next/image 도메인 설정 불필요 */}
              <img
                src={photo.photoUrl}
                alt={`${photo.placeName} 인증사진`}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <p className="truncate px-1.5 py-1 text-[11px] text-ink/60">{photo.placeName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}