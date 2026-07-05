'use client'

type Props = {
  text: string
  path?: string
  label?: string
  className?: string
}

export default function KakaoShareButton({
  text,
  path = '/',
  label = '📤 카카오톡 친구에게 공유하기',
  className = '',
}: Props) {
  const handleShare = () => {
    if (typeof window === 'undefined' || !window.Kakao) {
      console.error('Kakao SDK가 아직 로드되지 않았습니다')
      return
    }
    const url = `${window.location.origin}${path}`
    window.Kakao.Share.sendDefault({
      objectType: 'text',
      text,
      link: {
        mobileWebUrl: url,
        webUrl: url,
      },
    })
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-coral underline underline-offset-4 ${className}`}
    >
      {label}
    </button>
  )
}