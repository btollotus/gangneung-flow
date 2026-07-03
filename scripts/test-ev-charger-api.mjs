// 한국환경공단 전기차충전소 API 테스트 스크립트
// 실행: node --env-file=.env.local scripts/test-ev-charger-api.mjs
// .env.local에 GN_ITS_API_KEY=(공공데이터포털 인증키) 필요 (주차장 API와 동일 키 공용 확인됨)
//
// 문서(한국환경공단_전기자동차_충전소_정보_OpenAPI활용가이드_v1_23.docx)에서 확인된
// 요청 파라미터 그대로 사용. zcode=51(강원특별자치도), zscode=51150(강릉시)

const SERVICE_KEY = process.env.GN_ITS_API_KEY;

if (!SERVICE_KEY) {
  console.error("❌ GN_ITS_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

const BASE = "https://apis.data.go.kr/B552584/EvCharger";

async function callApi(operation, params = {}) {
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${BASE}/${operation}?serviceKey=${SERVICE_KEY}&${query}`;

  console.log(`\n=== ${operation} 요청 ===`);
  console.log(url.replace(SERVICE_KEY, "[KEY 마스킹]"));

  const res = await fetch(url);
  const text = await res.text();

  console.log(`상태 코드: ${res.status}`);
  console.log(`원문 응답 길이: ${text.length}자`);
  console.log(`원문 응답: ${text}`);
}

async function main() {
  // 1. 충전기 정보 조회 — 강릉시(zscode=51150) 필터
  await callApi("getChargerInfo", {
    pageNo: 1,
    numOfRows: 20,
    zcode: 51,
    zscode: 51150,
    dataType: "JSON",
  });

  // 2. 충전기 상태 조회 — 강릉시(zscode 파라미터는 문서상 없음, zcode만 지원)
  await callApi("getChargerStatus", {
    pageNo: 1,
    numOfRows: 20,
    zcode: 51,
    dataType: "JSON",
  });
}

main().catch((err) => {
  console.error("❌ 에러 발생:", err);
});
