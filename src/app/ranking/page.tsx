import { getWeeklyRanking } from "./actions";

export default async function RankingPage() {
  const { ranking, myRank } = await getWeeklyRanking();

  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="mb-4 text-lg font-bold text-ink">이번 주 랭킹</h1>

      {/* 내 순위 카드 */}
      {myRank ? (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-coral/10 px-4 py-4">
          <div>
            <p className="text-xs text-ink/60">내 순위</p>
            <p className="text-base font-bold text-ink">{myRank.nickname}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-coral">{myRank.rank}위</p>
            <p className="text-xs text-ink/60">{myRank.weekly_xp} XP</p>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl bg-ink/5 px-4 py-4 text-center text-sm text-ink/60">
          이번 주 아직 활동이 없어요. 장소를 방문하고 XP를 모아보세요!
        </div>
      )}

      {/* 전체 랭킹 리스트 */}
      {ranking.length === 0 ? (
        <p className="text-center text-sm text-ink/40">
          이번 주 랭킹 데이터가 아직 없어요.
        </p>
      ) : (
        <ul className="space-y-2">
          {ranking.map((row) => {
            const isMe = myRank !== null && row.user_id === myRank.user_id;
            return (
              <li
                key={row.user_id}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  isMe ? "bg-coral/10" : "bg-ink/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 text-sm font-bold ${
                      row.rank <= 3 ? "text-coral" : "text-ink/60"
                    }`}
                  >
                    {row.rank}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {row.nickname}
                    {isMe && (
                      <span className="ml-1 text-xs text-coral">(나)</span>
                    )}
                  </span>
                </div>
                <span className="text-sm text-ink/70">
                  {row.weekly_xp} XP
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
