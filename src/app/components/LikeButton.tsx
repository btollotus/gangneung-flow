'use client'

/**
 * 인증사진 좋아요 하트 버튼 (controlled).
 * - count/liked는 부모가 관리한다 (그리드 카드와 라이트박스가 같은 사진의 상태를 공유해야 하므로,
 *   버튼 내부에 자체 state를 두지 않는다 — 각 인스턴스가 따로 state를 가지면 같은 사진인데
 *   카드와 라이트박스의 좋아요 개수가 서로 어긋나는 문제가 생긴다)
 * - 클릭 시 실제 토글 로직(서버 액션 호출, optimistic update, 롤백)은 onToggle 콜백으로 부모에 위임
 */
export default function LikeButton({
  liked,
  count,
  pending = false,
  onToggle,
  size = 'sm',
}: {
  liked: boolean
  count: number
  pending?: boolean
  onToggle: () => void
  size?: 'sm' | 'lg'
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pending) return
    onToggle()
  }

  const isSmall = size === 'sm'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={liked ? '좋아요 취소' : '좋아요'}
      className={
        isSmall
          ? 'flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-white backdrop-blur-sm'
          : 'flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sand'
      }
    >
      <span className={isSmall ? 'text-[11px] leading-none' : 'text-base leading-none'}>
        {liked ? '❤️' : '🤍'}
      </span>
      <span className={isSmall ? 'text-[10px] font-semibold leading-none' : 'text-xs font-semibold leading-none'}>
        {count}
      </span>
    </button>
  )
}