// 전기차충전소 기본정보 동기화 스크립트
// 실행: node --env-file=.env.local scripts/sync-ev-chargers.mjs
//
// getChargerInfo(기본정보)를 호출해 public.ev_chargers 테이블에 upsert한다.
// - 실시간 상태(getChargerStatus)는 여기서 저장하지 않는다 (evCharger.ts가 매 요청 시 API 직접 호출).
// - stat_id + chger_id 복합 기준 upsert.
// - 총 2,446건(2026-07-04 확인) — numOfRows는 여유있게 3000으로 설정.

import { createClient } from "@supabase/supabase-js";

const SERVICE_KEY = process.env.GN_ITS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ GN_ITS_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다."
  );
  process.exit(1);
}

const BASE = "https://apis.data.go.kr/B552584/EvCharger";

async function fetchAllChargers() {
  const params = {
    pageNo: 1,
    numOfRows: 3000, // totalCount(2,446)보다 넉넉하게
    zcode: 51,
    zscode: 51150,
    dataType: "JSON",
  };
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${BASE}/getChargerInfo?serviceKey=${SERVICE_KEY}&${query}`;

  const res = await fetch(url);
  const text = await res.text();

  if (res.status !== 200) {
    throw new Error(`getChargerInfo 요청 실패 (상태 코드 ${res.status}): ${text}`);
  }

  const json = JSON.parse(text);

  // ⚠️ 이 API는 header/body 래핑이 없는 flat 구조 (parking API와 다름)
  if (json.resultCode !== "00") {
    throw new Error(`getChargerInfo 응답 오류: ${json.resultMsg ?? "알 수 없는 오류"}`);
  }

  const items = json.items?.item ?? [];
  const totalCount = json.totalCount ?? 0;

  console.log(`총 ${totalCount}건 중 ${items.length}건 수신`);

  if (items.length < totalCount) {
    console.warn(
      `⚠️ 수신 건수(${items.length})가 totalCount(${totalCount})보다 적습니다. numOfRows를 늘려야 할 수 있습니다.`
    );
  }

  return items;
}

function mapToDbRow(item) {
  return {
    stat_id: item.statId,
    chger_id: item.chgerId,
    stat_nm: item.statNm,
    addr: item.addr,
    lat: item.lat ? Number(item.lat) : null,
    lng: item.lng ? Number(item.lng) : null,
    chger_type: item.chgerType,
    output: item.output,
    parking_free: item.parkingFree,
    use_time: item.useTime,
    synced_at: new Date().toISOString(),
  };
}

async function main() {
  console.log("=== 전기차충전소 기본정보 동기화 시작 ===");

  const items = await fetchAllChargers();

  if (items.length === 0) {
    console.error("❌ 수신된 충전소 데이터가 없습니다. 동기화를 중단합니다.");
    process.exit(1);
  }

  const rows = items.map(mapToDbRow);

  const invalidRows = rows.filter((r) => !r.stat_id || !r.chger_id);
  if (invalidRows.length > 0) {
    console.error(
      `❌ stat_id 또는 chger_id가 없는 행이 ${invalidRows.length}건 있습니다. 동기화를 중단합니다.`,
      invalidRows
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("ev_chargers")
    .upsert(rows, { onConflict: "stat_id,chger_id" })
    .select("stat_id, chger_id, stat_nm");

  if (error) {
    console.error("❌ upsert 오류:", error.message);
    process.exit(1);
  }

  console.log(`✅ ${data.length}건 upsert 완료`);
}

main().catch((err) => {
  console.error("❌ 동기화 중 예외 발생:", err);
  process.exit(1);
});