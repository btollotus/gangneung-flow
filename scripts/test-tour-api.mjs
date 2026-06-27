// scripts/test-tour-api.mjs
// 사용법: node --env-file=.env.local scripts/test-tour-api.mjs

const serviceKey = process.env.TOUR_API_SERVICE_KEY;

if (!serviceKey) {
  console.error("❌ TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

const KEYWORD = "경포"; // 테스트할 장소명 1곳 (범위 넓혀서 재검색)

// 주의: serviceKey는 이미 Encoding된 값이므로 URLSearchParams를 쓰지 않고
// 직접 문자열로 붙인다 (이중 인코딩 방지)
const url =
  `https://apis.data.go.kr/B551011/KorService2/searchKeyword2` +
  `?serviceKey=${serviceKey}` +
  `&MobileOS=ETC` +
  `&MobileApp=gangneungflow` +
  `&_type=json` +
  `&areaCode=32` +
  `&numOfRows=30` +
  `&keyword=${encodeURIComponent(KEYWORD)}`;

console.log("요청 키워드:", KEYWORD);

const res = await fetch(url);
const data = await res.json();

console.log(JSON.stringify(data, null, 2));