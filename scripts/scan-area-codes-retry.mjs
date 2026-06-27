// scripts/scan-area-codes-retry.mjs
// 목적: 1차 스캔(scan-area-codes.mjs)에서 "검색 결과 0건"이 나온 18곳을 재시도.
//       12곳은 가설 키워드로, 6곳은 원래 검색어 그대로(진짜 미등록인지 재확인용).
// 실행: node --env-file=.env.local scripts/scan-area-codes-retry.mjs

import { writeFile } from "node:fs/promises";

const serviceKey = process.env.TOUR_API_SERVICE_KEY;
if (!serviceKey) {
  console.error("TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

const PLACES = [
  { tier: "landmark", name: "경포해변", prevKeyword: "경포해변", keyword: "경포해수욕장", hypothesis: true },
  { tier: "landmark", name: "강릉중앙시장", prevKeyword: "강릉중앙시장", keyword: "중앙시장", hypothesis: true },
  { tier: "landmark", name: "강릉대도호부관아", prevKeyword: "강릉대도호부관아", keyword: "임영관", hypothesis: true },
  { tier: "landmark", name: "모래시계공원(정동진)", prevKeyword: "정동진 모래시계공원", keyword: "모래시계공원", hypothesis: true },
  { tier: "underrated", name: "강릉월화거리", prevKeyword: "강릉월화거리", keyword: "월화거리", hypothesis: true },
  { tier: "underrated", name: "사천진바위섬", prevKeyword: "사천진바위섬", keyword: "사천진리 해변", hypothesis: true },
  { tier: "underrated", name: "강릉모루도서관", prevKeyword: "강릉모루도서관", keyword: "모루도서관", hypothesis: true },
  { tier: "underrated", name: "강릉시립중앙도서관", prevKeyword: "강릉시립중앙도서관", keyword: "강릉시립도서관", hypothesis: true },
  { tier: "underrated", name: "농산물 새벽시장", prevKeyword: "강릉 농산물 새벽시장", keyword: "강릉새벽시장", hypothesis: true },
  { tier: "underrated", name: "중앙성남전통시장", prevKeyword: "중앙성남전통시장", keyword: "성남시장", hypothesis: true },
  { tier: "underrated", name: "월화거리야시장", prevKeyword: "월화거리야시장", keyword: "월화거리", hypothesis: true },
  { tier: "mission", name: "굴산사지 당간지주", prevKeyword: "굴산사지 당간지주", keyword: "굴산사지", hypothesis: true },

  { tier: "underrated", name: "서울양계", prevKeyword: "서울양계", keyword: "서울양계", hypothesis: false },
  { tier: "underrated", name: "움찐이", prevKeyword: "움찐이", keyword: "움찐이", hypothesis: false },
  { tier: "underrated", name: "대게특별시", prevKeyword: "대게특별시", keyword: "대게특별시", hypothesis: false },
  { tier: "underrated", name: "교동대게", prevKeyword: "교동대게", keyword: "교동대게", hypothesis: false },
  { tier: "underrated", name: "초당작은도서관", prevKeyword: "초당작은도서관", keyword: "초당작은도서관", hypothesis: false },
  { tier: "underrated", name: "로하스강릉작은도서관", prevKeyword: "로하스강릉작은도서관", keyword: "로하스강릉작은도서관", hypothesis: false },
];

function buildUrl(keyword) {
  return (
    `https://apis.data.go.kr/B551011/KorService2/searchKeyword2` +
    `?serviceKey=${serviceKey}` +
    `&MobileOS=ETC` +
    `&MobileApp=gangneungflow` +
    `&_type=json` +
    `&numOfRows=10` +
    `&keyword=${encodeURIComponent(keyword)}`
  );
}

function normalizeItems(body) {
  const items = body?.items;
  if (!items || items === "") return [];
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const results = [];

  for (const place of PLACES) {
    const url = buildUrl(place.keyword);
    let body;
    let resultCode;
    let resultMsg;
    try {
      const res = await fetch(url);
      const data = await res.json();
      resultCode = data?.response?.header?.resultCode;
      resultMsg = data?.response?.header?.resultMsg;
      body = data?.response?.body;
    } catch (err) {
      console.log(`\n[${place.tier}] ${place.name} → 요청 실패: ${err.message}`);
      results.push({ ...place, error: err.message, candidates: [] });
      await sleep(300);
      continue;
    }

    if (resultCode && resultCode !== "0000") {
      console.log(
        `\n[${place.tier}] ${place.name} → ⚠️ API 에러 (resultCode=${resultCode}): ${resultMsg}`
      );
      results.push({ ...place, apiError: { resultCode, resultMsg }, candidates: [] });
      await sleep(300);
      continue;
    }

    const items = normalizeItems(body);
    const candidates = items.map((it) => ({
      title: it.title,
      contentid: it.contentid,
      contenttypeid: it.contenttypeid,
      areacode: it.areacode,
      sigungucode: it.sigungucode,
      addr1: it.addr1,
      mapx: it.mapx,
      mapy: it.mapy,
    }));

    console.log(
      `\n[${place.tier}] ${place.name}  (이전 검색어: "${place.prevKeyword}" → ${place.hypothesis ? "가설" : "동일"} 검색어: "${place.keyword}")`
    );
    console.log(`  totalCount: ${body?.totalCount ?? 0}`);
    if (candidates.length === 0) {
      console.log(
        place.hypothesis
          ? "  ⚠️  가설 키워드로도 결과 없음 — TourAPI 미등록 가능성이 더 높아짐"
          : "  ⚠️  여전히 결과 없음 — TourAPI 미등록으로 잠정 결론"
      );
    } else {
      candidates.forEach((c, i) => {
        const blank = !c.areacode || !c.sigungucode;
        const marker = blank ? " ⚠️ areacode/sigungucode 비어있음" : "";
        console.log(
          `  ${i + 1}. ${c.title} | contentid=${c.contentid} | type=${c.contenttypeid} | addr="${c.addr1 ?? ""}" | mapx/mapy="${c.mapx}/${c.mapy}"${marker}`
        );
      });
    }

    results.push({ ...place, candidates });
    await sleep(300);
  }

  console.log("\n\n========== 재시도 요약 ==========");
  const apiErrors = results.filter((r) => r.apiError);
  const stillNoResult = results.filter((r) => !r.apiError && !r.error && r.candidates.length === 0);
  const nowFound = results.filter((r) => r.candidates.length > 0);

  if (apiErrors.length > 0) {
    console.log(`API 에러가 난 곳 (${apiErrors.length}곳):`);
    apiErrors.forEach((r) => console.log(`  - ${r.name} (${r.apiError.resultCode}: ${r.apiError.resultMsg})`));
    console.log("");
  }

  console.log(`가설 적용 후에도 여전히 결과 없는 곳 (${stillNoResult.length}곳, TourAPI 미등록으로 잠정 결론):`);
  stillNoResult.forEach((r) => console.log(`  - ${r.name} (검색어: "${r.keyword}")`));

  console.log(`\n새로 결과가 나온 곳 (${nowFound.length}곳, 후보 중 직접 골라야 함):`);
  nowFound.forEach((r) => console.log(`  - ${r.name} (검색어: "${r.keyword}") → ${r.candidates.length}건`));

  console.log("\n\n========== 중복 의심 3곳 좌표 비교 ==========");
  const marketNames = ["강릉월화거리", "월화거리야시장", "중앙성남전통시장"];
  for (const name of marketNames) {
    const r = results.find((x) => x.name === name);
    if (!r || r.candidates.length === 0) {
      console.log(`${name}: 결과 없음 — 비교 불가`);
      continue;
    }
    r.candidates.forEach((c, i) => {
      console.log(`${name} 후보${i + 1}: ${c.title} | addr="${c.addr1 ?? ""}" | mapx/mapy="${c.mapx}/${c.mapy}"`);
    });
  }
  console.log(
    "\n→ 위 좌표들이 서로 거의 같다면(소수점 4자리 이상 일치) 같은 장소일 가능성이 높습니다. 직접 비교해서 알려주세요."
  );

  await writeFile(
    "scan-area-codes-retry-result.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );
  console.log("\n전체 결과를 scan-area-codes-retry-result.json 에 저장했습니다.");
}

main();