import Link from 'next/link'
import { getMyPageData } from './actions'
import NicknameEditor from './NicknameEditor'

const TOTAL_PLACES = 31

// 방문 날짜를 KST 기준 "M/D"로 표시한다.
function formatVisitDate(happenedAt: string): string {
  const kst = new Date(new Date(happenedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
  return `${kst.getMonth() + 1}/${kst.getDate()}`
}

export default async function MyPage() {
  const data = await getMyPageData()

  if (!data) {
    return (
      <div className="px-4 py-6 pb-24 text-center text-sm text-ink/60">
        로그인이 필요해요. 새로고침 후 다시 시도해주세요.
      </div>
    )
  }

  const { userId, nickname, visitedCount, totalXp, badgeCount, weeklyRank, recentVisits } = data

  return (
    <div className="px-4 py-6 pb-24">
      {/* 프로필 헤더 */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-seafoam text-lg font-bold text-sand">
          {nickname.slice(0, 1)}
        </div>
        <div>
          <p className="text-base font-bold text-ink">{nickname}</p>
          <p className="text-xs text-ink/50">
            {visitedCount} / {TOTAL_PLACES}곳 방문
          </p>
          <div className="mt-1">
            <NicknameEditor currentNickname={nickname} />
          </div>
        </div>
      </div>

      {/* 통계 카드 2x2 */}
      <div className="mb-6 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-ink/5 px-4 py-3">
          <p className="mb-1 text-xs text-ink/50">방문 장소</p>
          <p className="text-xl font-bold text-ink">
            {visitedCount}
            <span className="text-sm font-medium text-ink/40"> / {TOTAL_PLACES}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-ink/5 px-4 py-3">
          <p className="mb-1 text-xs text-ink/50">총 XP</p>
          <p className="text-xl font-bold text-coral">{totalXp}</p>
        </div>
        <div className="rounded-2xl bg-ink/5 px-4 py-3">
          <p className="mb-1 text-xs text-ink/50">뱃지</p>
          <p className="text-xl font-bold text-ink">{badgeCount}개</p>
        </div>
        <Link href="/ranking" className="rounded-2xl bg-ink/5 px-4 py-3">
          <p className="mb-1 text-xs text-ink/50">이번 주 순위</p>
          <p className="text-xl font-bold text-ink">{weeklyRank ? `${weeklyRank}위` : '-'}</p>
        </Link>
      </div>

      {/* 사진방 바로가기 */}
      <Link
        href={`/user/${userId}/photos`}
        className="mb-6 flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3"
      >
        <span className="text-sm font-semibold text-ink">📷 내 사진방</span>
        <span className="text-xs text-ink/40">보기 →</span>
      </Link>

      {/* 최근 방문 이력 */}
      <p className="mb-2 text-sm font-semibold text-ink">최근 방문</p>
      {recentVisits.length === 0 ? (
        <p className="text-center text-sm text-ink/40">아직 방문 기록이 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {recentVisits.map((v) => (
            <li
              key={`${v.placeId}-${v.happenedAt}`}
              className="flex items-center justify-between rounded-xl bg-ink/5 px-4 py-2.5"
            >
              <span className="text-sm text-ink">{v.placeName}</span>
              <span className="text-xs text-ink/50">{formatVisitDate(v.happenedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}