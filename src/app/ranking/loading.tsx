export default function RankingLoading() {
    const skeletonRows = Array.from({ length: 8 });
  
    return (
      <div className="px-4 py-6">
        {/* 내 순위 카드 스켈레톤 */}
        <div className="mb-6 h-24 animate-pulse rounded-2xl bg-ink/5" />
  
        {/* 리스트 스켈레톤 */}
        <div className="space-y-2">
          {skeletonRows.map((_, idx) => (
            <div
              key={idx}
              className="h-14 animate-pulse rounded-xl bg-ink/5"
            />
          ))}
        </div>
      </div>
    );
  }
  