// scripts/test-detail-image.mjs
// 사용법: node --env-file=.env.local scripts/test-detail-image.mjs
const serviceKey = process.env.TOUR_API_SERVICE_KEY;
if (!serviceKey) {
  console.error("❌ TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

const CONTENT_ID = "125790"; // 강릉 경포대 (확정)

const url =
  `https://apis.data.go.kr/B551011/KorService2/detailImage2` +
  `?serviceKey=${serviceKey}` +
  `&MobileOS=ETC` +
  `&MobileApp=gangneungflow` +
  `&_type=json` +
  `&contentId=${CONTENT_ID}`;

console.log("요청 URL:", url.replace(serviceKey, "***KEY***"));

const res = await fetch(url);
const data = await res.json();

const header = data?.response?.header;
console.log("resultCode:", header?.resultCode, "/ resultMsg:", header?.resultMsg);

const items = data?.response?.body?.items?.item;

if (!items) {
  console.log("⚠️ items가 없습니다. 전체 응답 출력:");
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const list = Array.isArray(items) ? items : [items];
console.log(`\n=== 수신된 이미지 수: ${list.length} ===`);
console.log(JSON.stringify(list, null, 2));