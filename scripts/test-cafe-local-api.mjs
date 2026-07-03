// 재단법인강원정보문화진흥원 카페/로컬음식점 API 테스트 스크립트
// 실행: node --env-file=.env.local scripts/test-cafe-local-api.mjs
// .env.local에 GN_ITS_API_KEY=(공공데이터포털 인증키) 필요
//
// ⚠️ 이 API는 요청변수(Request Parameter) 표를 아직 확보하지 못했습니다.
// 강릉시 API와 동일한 게이트웨이 표준 패턴(serviceKey/pageNo/numOfRows)으로 우선 시도합니다.
// 실패하면(빈 응답, 에러코드 10/11 등) 공공데이터포털에서
// getCafeList "확인" 버튼을 눌러 요청변수 표를 캡처해서 공유해주세요.

const SERVICE_KEY = process.env.GN_ITS_API_KEY;

if (!SERVICE_KEY) {
  console.error("❌ GN_ITS_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

const BASE = "https://apis.data.go.kr/B553299/storeservice";

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
  // 1. 카페 목록 조회
  await callApi("getCafeList", {
    pageNo: 1,
    numOfRows: 10,
    dataType: "JSON",
  });

  // 2. 로컬음식점 목록 조회
  await callApi("getLocalList", {
    pageNo: 1,
    numOfRows: 10,
    dataType: "JSON",
  });
}

main().catch((err) => {
  console.error("❌ 에러 발생:", err);
});
