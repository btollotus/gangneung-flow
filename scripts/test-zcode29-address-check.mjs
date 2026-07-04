// zcode=29(광주) 결과 안에 옛 전라남도 주소가 섞여 있는지 확인
// (전남광주통합특별시 출범 후 zcode=46이 0건인 이유를 파악하기 위한 테스트)
// 실행: node --env-file=.env.local scripts/test-zcode29-address-check.mjs
const SERVICE_KEY = process.env.GN_ITS_API_KEY;
if (!SERVICE_KEY) {
  console.error("❌ GN_ITS_API_KEY가 .env.local에 없습니다.");
  process.exit(1);
}

const url = `https://apis.data.go.kr/B552584/EvCharger/getChargerInfo?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=85&zcode=29&dataType=JSON`;

fetch(url)
  .then((r) => r.text())
  .then((text) => {
    const json = JSON.parse(text);
    const items = json.items?.item ?? [];
    console.log("총 건수:", json.totalCount);

    const addrPrefixes = new Set(items.map((i) => i.addr?.slice(0, 6)));
    console.log("주소 접두어 종류:", [...addrPrefixes]);

    const jeonnamItems = items.filter(
      (i) => i.addr?.startsWith("전라남도") || i.addr?.startsWith("전남")
    );
    console.log("전라남도 접두 주소 건수:", jeonnamItems.length);
    if (jeonnamItems.length > 0) {
      console.log("예시:", JSON.stringify(jeonnamItems[0], null, 2));
    }
  })
  .catch((err) => console.error("❌ 에러 발생:", err));