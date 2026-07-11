import { getUserPhotos } from './actions'
import PhotoGridClient from './PhotoGridClient'

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
        <PhotoGridClient photos={photos} />
      )}
    </div>
  )
}