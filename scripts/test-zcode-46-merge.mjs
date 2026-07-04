// 전남광주통합특별시 출범(2026-07-01)에 따라 EvCharger API의 zcode=46(전라남도)이
// 여전히 유효한지 확인하는 테스트 스크립트
// 실행: node --env-file=.env.local scripts/test-zcode-46-merge.mjs
const SERVICE_KEY = process.env.GN_ITS_API_KEY;
if (!SERVICE_KEY) {
  console.error("❌ GN_ITS_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

const url = `https://apis.data.go.kr/B552584/EvCharger/getChargerInfo?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=5&zcode=46&dataType=JSON`;

console.log("=== zcode=46 (전라남도, 통합 전 코드) 테스트 ===");
fetch(url)
  .then((res) => res.text().then((text) => ({ status: res.status, text })))
  .then(({ status, text }) => {
    console.log(`상태 코드: ${status}`);
    console.log(`원문 응답: ${text}`);
  })
  .catch((err) => console.error("❌ 에러 발생:", err));