"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RankingRow {
  user_id: string;
  nickname: string;
  weekly_xp: number;
  rank: number;
}

interface WeeklyRankingResult {
  ranking: RankingRow[];
  myRank: RankingRow | null;
}

/**
 * 이번 주(KST, 월요일 00:00 ~ 다음 주 월요일 00:00 직전) 범위를 반환한다.
 * 날짜/시간 지침: happened_at은 UTC 저장이므로 +09:00 명시해서 KST 자정을 정확히 지정한다.
 */
function getWeekRangeKST(): { start: string; end: string } {
  const nowKST = new Date(
    new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
  );
  const dayOfWeek = nowKST.getDay(); // 0=일, 1=월 ... 6=토
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(nowKST);
  monday.setDate(nowKST.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}T00:00:00+09:00`;

  return { start: fmt(monday), end: fmt(nextMonday) };
}

/**
 * 이번 주 XP 랭킹 전체 + 본인 순위를 반환한다.
 * - visits 테이블만 집계 대상 (place_actions는 로그 전용, XP 미반영)
 * - RLS 우회 위해 admin 클라이언트 사용 (visits/user_scores는 본인 행만 SELECT 가능한 RLS 걸려있음)
 */
export async function getWeeklyRanking(): Promise<WeeklyRankingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ranking: [], myRank: null };
  }

  const admin = createAdminClient();
  const { start, end } = getWeekRangeKST();

  const { data: visits, error: visitsError } = await admin
    .from("visits")
    .select("user_id, xp_earned")
    .gte("happened_at", start)
    .lt("happened_at", end);

  if (visitsError) {
    console.error("주간 랭킹 visits 조회 오류:", visitsError.message);
    return { ranking: [], myRank: null };
  }

  const xpMap = new Map<string, number>();
  for (const v of visits ?? []) {
    xpMap.set(v.user_id, (xpMap.get(v.user_id) ?? 0) + v.xp_earned);
  }

  if (xpMap.size === 0) {
    return { ranking: [], myRank: null };
  }

  const userIds = Array.from(xpMap.keys());
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("user_id, nickname")
    .in("user_id", userIds);

  if (profilesError) {
    console.error("주간 랭킹 profiles 조회 오류:", profilesError.message);
  }
  const nicknameMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p.nickname])
  );

  const ranking: RankingRow[] = Array.from(xpMap.entries())
    .map(([user_id, weekly_xp]) => ({
      user_id,
      nickname: nicknameMap.get(user_id) ?? `익명${user_id.slice(-4)}`,
      weekly_xp,
      rank: 0,
    }))
    .sort((a, b) => b.weekly_xp - a.weekly_xp)
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  const myRank = ranking.find((r) => r.user_id === user.id) ?? null;

  return { ranking, myRank };
}