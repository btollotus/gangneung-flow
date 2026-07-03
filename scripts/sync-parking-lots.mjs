// 강릉시 주차장 기본정보 동기화 스크립트
// 실행: node --env-file=.env.local scripts/sync-parking-lots.mjs
//
// getParkInfo(기본정보)를 호출해 public.parking_lots 테이블에 upsert한다.
// - 실시간 가용면수(getParkRltm)는 여기서 저장하지 않는다 (CCTV와 동일하게 매 요청 시 API 직접 호출하는 설계).
// - prk_id 기준 upsert (parking_lots.prk_id는 UNIQUE 제약).
// - 주차장 개설/폐쇄 등 기본정보가 바뀌었을 때 재실행하면 된다 (1회성 아님).

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

const BASE = "https://apis.data.go.kr/4201000/GNitsTrafficInfoService_1.0";

// 이중 인코딩 방지: 이미 인코딩된 서비스키를 raw string으로 이어붙임
async function fetchAllParkingLots() {
  const params = {
    pageNo: 1,
    numOfRows: 100, // totalCount(13)보다 넉넉하게 잡아 한 번에 전체 조회
    dataType: "JSON",
  };
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${BASE}/getParkInfo?serviceKey=${SERVICE_KEY}&${query}`;

  const res = await fetch(url);
  const text = await res.text();

  if (res.status !== 200) {
    throw new Error(`getParkInfo 요청 실패 (상태 코드 ${res.status}): ${text}`);
  }

  const json = JSON.parse(text);

  if (json.header?.resultCode !== "00") {
    throw new Error(
      `getParkInfo 응답 오류: ${json.header?.resultMsg ?? "알 수 없는 오류"}`
    );
  }

  const items = json.body?.items?.item ?? [];
  const totalCount = json.body?.totalCount ?? 0;

  console.log(`총 ${totalCount}건 중 ${items.length}건 수신`);

  if (items.length < totalCount) {
    console.warn(
      `⚠️ 수신 건수(${items.length})가 totalCount(${totalCount})보다 적습니다. numOfRows를 늘려야 할 수 있습니다.`
    );
  }

  return items;
}

// API 필드(camelCase) → DB 컬럼(snake_case) 매핑
function mapToDbRow(item) {
  return {
    prk_id: item.prkId,
    name: item.prkName,
    address: item.prkAddr,
    lng: item.xCrdn ? Number(item.xCrdn) : null,
    lat: item.yCrdn ? Number(item.yCrdn) : null,
    park_type: item.prkType,
    week_open_time: item.weekOpenTime,
    week_end_time: item.weekEndTime,
    sat_open_time: item.satOpenTime,
    sat_end_time: item.satEndTime,
    holi_open_time: item.holiOpenTime,
    holi_end_time: item.holiEndTime,
    synced_at: new Date().toISOString(),
  };
}

async function main() {
  console.log("=== 주차장 기본정보 동기화 시작 ===");

  const items = await fetchAllParkingLots();

  if (items.length === 0) {
    console.error("❌ 수신된 주차장 데이터가 없습니다. 동기화를 중단합니다.");
    process.exit(1);
  }

  const rows = items.map(mapToDbRow);

  // 필수 필드 누락 확인 (prk_id 없으면 upsert 기준 충돌)
  const invalidRows = rows.filter((r) => !r.prk_id);
  if (invalidRows.length > 0) {
    console.error(
      `❌ prk_id가 없는 행이 ${invalidRows.length}건 있습니다. 동기화를 중단합니다.`,
      invalidRows
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("parking_lots")
    .upsert(rows, { onConflict: "prk_id" })
    .select("prk_id, name");

  if (error) {
    console.error("❌ upsert 오류:", error.message);
    process.exit(1);
  }

  console.log(`✅ ${data.length}건 upsert 완료:`);
  for (const row of data) {
    console.log(`  - ${row.prk_id}: ${row.name}`);
  }
}

main().catch((err) => {
  console.error("❌ 동기화 중 예외 발생:", err);
  process.exit(1);
});
