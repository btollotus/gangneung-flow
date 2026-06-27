// scripts/scan-area-codes.mjs
// 목적: 33곳 전체에 대해 searchKeyword2를 "지역 제한 없이" 호출해서
//       areacode/sigungucode가 빈 값인 항목이 있는지 사전 스캔.
// 실행: node --env-file=.env.local scripts/scan-area-codes.mjs
//
// 주의: 이 스크립트는 DB(places 테이블)를 건드리지 않음. 콘솔 출력 + JSON 파일 저장만 함.
// 검증된 패턴 적용:
//   - serviceKey는 이미 Encoding된 값이므로 추가 encodeURIComponent 하지 않음
//   - keyword만 encodeURIComponent 적용
//   - areaCode 파라미터 자체를 넣지 않음 (전국 검색)

import { writeFile } from "node:fs/promises";

const serviceKey = process.env.TOUR_API_SERVICE_KEY;
if (!serviceKey) {
  console.error("TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

// 33곳 — name: DB에 들어간 이름 그대로, keyword: 검색에 쓸 키워드(필요시 단순화)
const PLACES = [
  // 랜드마크 10
  { tier: "landmark", name: "경포해변", keyword: "경포해변" },
  { tier: "landmark", name: "경포대", keyword: "경포대" },
  { tier: "landmark", name: "안목해변 커피거리", keyword: "안목해변" },
  { tier: "landmark", name: "오죽헌", keyword: "오죽헌" },
  { tier: "landmark", name: "강릉중앙시장", keyword: "강릉중앙시장" },
  { tier: "landmark", name: "주문진수산시장", keyword: "주문진수산시장" },
  { tier: "landmark", name: "선교장", keyword: "선교장" },
  { tier: "landmark", name: "강릉대도호부관아", keyword: "강릉대도호부관아" },
  { tier: "landmark", name: "하슬라아트월드", keyword: "하슬라아트월드" },
  { tier: "landmark", name: "모래시계공원(정동진)", keyword: "정동진 모래시계공원" },

  // 소외상권 20
  { tier: "underrated", name: "서울양계", keyword: "서울양계" },
  { tier: "underrated", name: "강릉월화거리", keyword: "강릉월화거리" },
  { tier: "underrated", name: "송정해수욕장", keyword: "송정해수욕장" },
  { tier: "underrated", name: "움찐이", keyword: "움찐이" },
  { tier: "underrated", name: "풍호마을", keyword: "풍호마을" },
  { tier: "underrated", name: "사천해변", keyword: "사천해변" },
  { tier: "underrated", name: "사천진바위섬", keyword: "사천진바위섬" },
  { tier: "underrated", name: "초당순두부마을", keyword: "초당순두부마을" },
  { tier: "underrated", name: "솔향대게", keyword: "솔향대게" },
  { tier: "underrated", name: "대게특별시", keyword: "대게특별시" },
  { tier: "underrated", name: "교동대게", keyword: "교동대게" },
  { tier: "underrated", name: "강릉모루도서관", keyword: "강릉모루도서관" },
  { tier: "underrated", name: "강릉시립중앙도서관", keyword: "강릉시립중앙도서관" },
  { tier: "underrated", name: "초당작은도서관", keyword: "초당작은도서관" },
  { tier: "underrated", name: "로하스강릉작은도서관", keyword: "로하스강릉작은도서관" },
  { tier: "underrated", name: "연곡해변", keyword: "연곡해변" },
  { tier: "underrated", name: "농산물 새벽시장", keyword: "강릉 농산물 새벽시장" },
  { tier: "underrated", name: "중앙성남전통시장", keyword: "중앙성남전통시장" },
  { tier: "underrated", name: "월화거리야시장", keyword: "월화거리야시장" },
  { tier: "underrated", name: "강문해변", keyword: "강문해변" },

  // 특별미션 3
  { tier: "mission", name: "안반데기", keyword: "안반데기" },
  { tier: "mission", name: "노추산 모정탑길", keyword: "노추산 모정탑길" },
  { tier: "mission", name: "굴산사지 당간지주", keyword: "굴산사지 당간지주" },
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
    }));

    const exactOrCloseMatch = candidates.find(
      (c) => c.title === place.name || c.title?.includes(place.name) || place.name.includes(c.title ?? "")
    );

    console.log(`\n[${place.tier}] ${place.name}  (검색어: "${place.keyword}")`);
    console.log(`  totalCount: ${body?.totalCount ?? 0}`);
    if (candidates.length === 0) {
      console.log("  ⚠️  검색 결과 없음 — 이 장소는 TourAPI에 등록 안 됐을 가능성");
    } else {
      candidates.forEach((c, i) => {
        const blank = !c.areacode || !c.sigungucode;
        const marker = blank ? " ⚠️ areacode/sigungucode 비어있음" : "";
        console.log(
          `  ${i + 1}. ${c.title} | contentid=${c.contentid} | type=${c.contenttypeid} | areacode="${c.areacode}" sigungucode="${c.sigungucode}"${marker}`
        );
      });
      if (!exactOrCloseMatch) {
        console.log("  ⚠️  이름이 정확히 일치하는 후보를 못 찾음 — 수동 확인 필요");
      }
    }

    results.push({ ...place, candidates, exactOrCloseMatch: exactOrCloseMatch ?? null });
    await sleep(300); // API 과호출 방지용 최소 지연
  }

  // ── 요약 ──
  console.log("\n\n========== 요약 ==========");
  const apiErrors = results.filter((r) => r.apiError);
  const noResult = results.filter((r) => !r.apiError && !r.error && r.candidates.length === 0);
  const blankCodeOnly = results.filter(
    (r) =>
      r.candidates.length > 0 &&
      r.exactOrCloseMatch &&
      (!r.exactOrCloseMatch.areacode || !r.exactOrCloseMatch.sigungucode)
  );
  const noMatch = results.filter((r) => r.candidates.length > 0 && !r.exactOrCloseMatch);

  console.log(`API 에러가 난 곳 (${apiErrors.length}곳, 파라미터/키 문제일 수 있음 — 먼저 확인):`);
  apiErrors.forEach((r) => console.log(`  - ${r.name} (${r.apiError.resultCode}: ${r.apiError.resultMsg})`));

  console.log(`\n검색 결과 자체가 없는 곳 (${noResult.length}곳):`);
  noResult.forEach((r) => console.log(`  - ${r.name}`));

  console.log(`\n이름은 매칭됐지만 areacode/sigungucode가 빈 값인 곳 (${blankCodeOnly.length}곳):`);
  blankCodeOnly.forEach((r) => console.log(`  - ${r.name} (contentid=${r.exactOrCloseMatch.contentid})`));

  console.log(`\n이름이 정확히 매칭되는 후보를 못 찾은 곳 (${noMatch.length}곳, 수동 확인 필요):`);
  noMatch.forEach((r) => console.log(`  - ${r.name}`));

  await writeFile(
    "scan-area-codes-result.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );
  console.log("\n전체 결과를 scan-area-codes-result.json 에 저장했습니다.");
}

main();
