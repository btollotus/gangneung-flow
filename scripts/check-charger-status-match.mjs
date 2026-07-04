// 충전소 실시간 상태 "정보 없음" 원인 진단 스크립트 (읽기 전용, DB/코드 수정 없음)
// 실행: node --env-file=.env.local scripts/check-charger-status-match.mjs
//
// 목적: ev_chargers 테이블의 stat_id/chger_id 값과
//       getChargerStatus(강원도 전체) 응답의 statId/chgerId 값이
//       실제로 같은 포맷/값으로 매칭되는지 직접 대조한다.

import { createClient } from "@supabase/supabase-js";

const SERVICE_KEY = process.env.GN_ITS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ GN_ITS_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

const BASE = "https://apis.data.go.kr/B552584/EvCharger";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== 1. DB에서 샘플 충전소 5건 조회 ===");
  const { data: samples, error } = await supabase
    .from("ev_chargers")
    .select("stat_id, chger_id, stat_nm")
    .limit(5);

  if (error) {
    console.error("❌ DB 조회 오류:", error.message);
    process.exit(1);
  }
  if (!samples || samples.length === 0) {
    console.error("❌ ev_chargers 테이블에 데이터가 없습니다.");
    process.exit(1);
  }

  samples.forEach((s) =>
    console.log(`  DB: stat_id="${s.stat_id}" chger_id="${s.chger_id}" (${s.stat_nm})`)
  );

  console.log("\n=== 2. getChargerStatus(zcode=51) 호출 ===");
  const params = { pageNo: 1, numOfRows: 1000, zcode: 51, dataType: "JSON" };
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${BASE}/getChargerStatus?serviceKey=${SERVICE_KEY}&${query}`;

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (res.status !== 200) {
    console.error(`❌ 요청 실패 (상태 코드 ${res.status}): ${text}`);
    process.exit(1);
  }

  const json = JSON.parse(text);
  if (json.resultCode !== "00") {
    console.error(`❌ 응답 오류: ${json.resultMsg ?? "알 수 없는 오류"}`);
    process.exit(1);
  }

  const items = json.items?.item ?? [];
  console.log(`  totalCount=${json.totalCount}, 수신 건수=${items.length}`);

  console.log("\n=== 3. getChargerStatus 응답 샘플 5건 (원본 포맷 확인용) ===");
  items.slice(0, 5).forEach((it) =>
    console.log(`  STATUS: statId="${it.statId}" chgerId="${it.chgerId}" stat="${it.stat}"`)
  );

  console.log("\n=== 4. DB 샘플 5건이 getChargerStatus 응답에 실제로 존재하는지 대조 ===");
  const statusMap = new Map();
  for (const it of items) {
    if (it.statId && it.chgerId) {
      statusMap.set(`${it.statId}_${it.chgerId}`, it.stat);
    }
  }

  let matchCount = 0;
  for (const s of samples) {
    const key = `${s.stat_id}_${s.chger_id}`;
    const found = statusMap.get(key);
    if (found !== undefined) {
      matchCount++;
      console.log(`  ✅ 매칭됨: ${key} → stat=${found}`);
    } else {
      console.log(`  ❌ 매칭 안됨: ${key}`);
    }
  }

  console.log(`\n=== 결과: 샘플 ${samples.length}건 중 ${matchCount}건 매칭 ===`);
  if (matchCount === 0) {
    console.log(
      "→ 매칭이 0건이면: 키 포맷 불일치(버그) 가능성이 높음. 위 2번/3번 출력에서 statId/chgerId 형태(자릿수, 대소문자, 공백 등)를 눈으로 직접 비교할 것."
    );
  } else {
    console.log(
      "→ 일부라도 매칭되면: 매칭 로직 자체는 정상. 나머지 '정보 없음'은 해당 충전소가 강원도 전체 831건 안에 실제로 없는 정상 케이스일 가능성이 높음."
    );
  }
}

main().catch((err) => {
  console.error("❌ 예외 발생:", err);
  process.exit(1);
});
