// 강릉시 주차장 API 테스트 스크립트
// 실행: node --env-file=.env.local scripts/test-parking-api.mjs
// .env.local에 GN_ITS_API_KEY=(공공데이터포털에서 받은 Encoding 인증키) 추가 필요
//
// 목적: getParkInfo(기본정보)·getParkRltm(실시간정보) 실제 응답 필드를
// 추측 없이 확인하기 위함. 응답 결과를 그대로 복사해서 다음 세션/메시지에 공유해주세요.

const SERVICE_KEY = process.env.GN_ITS_API_KEY;

if (!SERVICE_KEY) {
  console.error("❌ GN_ITS_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

const BASE = "https://apis.data.go.kr/4201000/GNitsTrafficInfoService_1.0";

// 이중 인코딩 방지: 이미 인코딩된 서비스키를 raw string으로 이어붙임
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
  try {
    const json = JSON.parse(text);
    console.log("파싱된 JSON:", JSON.stringify(json, null, 2));
  } catch {
    console.log("(JSON 파싱 실패 — 위 원문 응답 참고)");
  }
}

async function main() {
  // 1. 주차장 기본정보 (전체 목록 일부만 조회) — 기존과 동일, 정상 확인됨
  await callApi("getParkInfo", {
    pageNo: 1,
    numOfRows: 10,
    dataType: "JSON",
  });

  // 2. 주차장 실시간정보 — 진단용: 문서에 명시된 파라미터만 (dataType 제외)
  await callApi("getParkRltm", {
    pageNo: 1,
    numOfRows: 10,
  });
}

main().catch((err) => {
  console.error("❌ 에러 발생:", err);
});
