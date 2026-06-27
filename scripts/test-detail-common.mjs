// scripts/test-detail-common.mjs
// 사용법: node --env-file=.env.local scripts/test-detail-common.mjs
const serviceKey = process.env.TOUR_API_SERVICE_KEY;
if (!serviceKey) {
  console.error("❌ TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

const CONTENT_ID = "3454461"; // 경포호수광장
const CONTENT_TYPE_ID = "12"; // 관광지

const url =
  `https://apis.data.go.kr/B551011/KorService2/detailCommon2` +
  `?serviceKey=${serviceKey}` +
  `&MobileOS=ETC` +
  `&MobileApp=gangneungflow` +
  `&_type=json` +
  `&contentId=${CONTENT_ID}` +
  `&contentTypeId=${CONTENT_TYPE_ID}` +
  `&defaultYN=Y` +
  `&firstImageYN=Y` +
  `&areacodeYN=Y` +
  `&catcodeYN=Y` +
  `&addrinfoYN=Y` +
  `&mapinfoYN=Y` +
  `&overviewYN=Y` +
  `&transGuideYN=Y`;

console.log("요청 URL:", url.replace(serviceKey, "***KEY***"));

const res = await fetch(url);
const data = await res.json();

const header = data?.response?.header;
console.log("resultCode:", header?.resultCode, "/ resultMsg:", header?.resultMsg);

const item = data?.response?.body?.items?.item;
const detail = Array.isArray(item) ? item[0] : item;

if (!detail) {
  console.log("⚠️ item이 없습니다. 전체 응답 출력:");
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

console.log("\n=== 주요 필드 ===");
console.log("title:", detail.title);
console.log("addr1:", detail.addr1);
console.log("addr2:", detail.addr2);
console.log("mapx:", detail.mapx);
console.log("mapy:", detail.mapy);
console.log("\n=== overview (개요 전문) ===");
console.log(detail.overview);