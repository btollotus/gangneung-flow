// zcode 파라미터가 실제로 필수인지 확인하는 테스트
// (필수가 아니라면 지역코드 매핑 없이 주소 문자열로 직접 필터링하는 대안이 가능해짐)
// 실행: node --env-file=.env.local scripts/test-zcode-optional.mjs
const SERVICE_KEY = process.env.GN_ITS_API_KEY;
if (!SERVICE_KEY) {
  console.error("❌ GN_ITS_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

async function test(label, params) {
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `https://apis.data.go.kr/B552584/EvCharger/getChargerInfo?serviceKey=${SERVICE_KEY}&${query}`;
  console.log(`\n=== ${label} ===`);
  const res = await fetch(url);
  const text = await res.text();
  console.log(`상태 코드: ${res.status}`);
  console.log(`원문 응답(앞 500자): ${text.slice(0, 500)}`);
}

async function main() {
  // 1. zcode 없이 호출 (필수 여부 확인)
  await test("zcode 없이 호출", { pageNo: 1, numOfRows: 3, dataType: "JSON" });

  // 2. zcode=29 (광주광역시, 통합 전 코드) - 46과 마찬가지로 0건인지 확인
  await test("zcode=29 (광주, 통합 전 코드)", { pageNo: 1, numOfRows: 3, zcode: 29, dataType: "JSON" });
}

main().catch((err) => console.error("❌ 에러 발생:", err));