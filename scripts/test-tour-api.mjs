// scripts/test-tour-api.mjs
// 사용법: node --env-file=.env.local scripts/test-tour-api.mjs

const serviceKey = process.env.TOUR_API_SERVICE_KEY;

if (!serviceKey) {
  console.error("❌ TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

const KEYWORD = "송정"; // 전국 대상, areaCode 제한 없이 재검색 — 부산 송정해수욕장과 강릉 것을 구분하기 위한 검색

// 주의: serviceKey는 이미 Encoding된 값이므로 URLSearchParams를 쓰지 않고
// 직접 문자열로 붙인다 (이중 인코딩 방지)
const url =
  `https://apis.data.go.kr/B551011/KorService2/searchKeyword2` +
  `?serviceKey=${serviceKey}` +
  `&MobileOS=ETC` +
  `&MobileApp=gangneungflow` +
 `&_type=json` +
  `&numOfRows=70` +
  `&keyword=${encodeURIComponent(KEYWORD)}`;

console.log("요청 키워드:", KEYWORD);

const res = await fetch(url);
const data = await res.json();

console.log(JSON.stringify(data, null, 2));