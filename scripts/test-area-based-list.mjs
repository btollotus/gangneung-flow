// scripts/test-area-based-list.mjs
const serviceKey = process.env.TOUR_API_SERVICE_KEY;
if (!serviceKey) {
  console.error("❌ TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

const url =
  `https://apis.data.go.kr/B551011/KorService2/areaBasedList2` +
  `?serviceKey=${serviceKey}` +
  `&MobileOS=ETC` +
  `&MobileApp=gangneungflow` +
  `&_type=json` +
  `&contentTypeId=12` +
  `&areaCode=32` +
  `&sigunguCode=1` +
  `&numOfRows=200` +
  `&pageNo=1` +
  `&arrange=A`;

console.log("요청 URL:", url.replace(serviceKey, "***KEY***"));

const res = await fetch(url);
const data = await res.json();

const header = data?.response?.header;
console.log("resultCode:", header?.resultCode, "/ resultMsg:", header?.resultMsg);

const totalCount = data?.response?.body?.totalCount;
console.log("totalCount:", totalCount);

const items = data?.response?.body?.items?.item;
if (!items) {
  console.log("⚠️ items가 없습니다. 전체 응답 출력:");
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const list = Array.isArray(items) ? items : [items];
console.log(`수신된 항목 수: ${list.length} (totalCount: ${totalCount})`);

// "경포" 포함 항목만 따로 필터링
const gyeongpoMatches = list.filter((it) => it.title?.includes("경포"));
console.log(`\n=== "경포" 포함 항목 (${gyeongpoMatches.length}건) ===`);
gyeongpoMatches.forEach((it) => {
  console.log(`- title: ${it.title} / contentid: ${it.contentid} / addr1: ${it.addr1}`);
});

console.log("\n=== 전체 목록 (제목만, 수동 스캔용) ===");
list.forEach((it) => {
  console.log(`- ${it.title} (contentid: ${it.contentid})`);
});