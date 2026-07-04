// 카카오 로컬 API - 좌표to행정구역 테스트 스크립트
// 실행: node --env-file=.env.local scripts/test-kakao-region-api.mjs
// .env.local에 KAKAO_REST_API_KEY=(카카오 디벨로퍼스에서 발급받은 REST API 키) 필요
//
// 목적: coord2regioncode 응답의 region_1depth_name이
// zcode 코드표(한국환경공단 EvCharger API 문서 3.4절)의 시/도명과
// 정확히 일치하는 문자열로 오는지 확인
const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
if (!REST_API_KEY) {
  console.error("❌ KAKAO_REST_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

const BASE = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";

async function testCoord(label, lat, lng) {
  const url = `${BASE}?x=${lng}&y=${lat}`;
  console.log(`\n=== ${label} (lat=${lat}, lng=${lng}) ===`);
  console.log(url);

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${REST_API_KEY}` },
  });
  const text = await res.text();
  console.log(`상태 코드: ${res.status}`);
  console.log(`원문 응답: ${text}`);
}

async function main() {
  // 1. 강릉 (강원특별자치도 예상)
  await testCoord("강릉시청 인근", 37.7519, 128.8760);

  // 2. 구례군 광의면 (전라남도 예상) - 실제 테스트했던 위치
  await testCoord("구례군 광의면", 35.2706, 127.4581);

  // 3. 서울 (경계 판별 안정성 확인용)
  await testCoord("서울시청 인근", 37.5665, 126.9780);
}

main().catch((err) => {
  console.error("❌ 에러 발생:", err);
});