// scripts/verify-candidates.mjs
// 목적: 후보가 2개 이상이었던 5곳(선교장/하슬라아트월드/연곡해변/강문해변/안반데기)에 대해
//       각 후보 contentid를 detailCommon2로 직접 조회해서 mapx/mapy를 받고,
//       원래 시드 좌표와의 거리를 비교해 어떤 contentid가 진짜인지 검증.
// 실행: node --env-file=.env.local scripts/verify-candidates.mjs
//
// 검증된 패턴: detailCommon2는 contentId 외 다른 파라미터를 받지 않음 (넣으면 에러).

import { writeFile } from "node:fs/promises";

const serviceKey = process.env.TOUR_API_SERVICE_KEY;
if (!serviceKey) {
  console.error("TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

// seedLat/seedLon: places_seed_33.sql에 들어간 원래 좌표
// candidates: 1차 스캔(scan-area-codes.mjs)에서 나온 후보들
const PLACES = [
    {
      name: "오죽헌",
      seedLat: 37.7792353,
      seedLon: 128.8775226,
      candidates: [
        { contentid: "129784", label: "강릉 오죽헌·시립박물관" },
        { contentid: "2390089", label: "강릉의 대표 유적지 오죽헌을 걷다 (여행코스)" },
        { contentid: "4062752", label: "오죽헌 전통뱃놀이 체험시설" },
        { contentid: "1348733", label: "오죽헌한정식 (식당, 다른 지역일 가능성)" },
      ],
    },
    {
      name: "선교장",
    seedLat: 37.7865369,
    seedLon: 128.8851213,
    candidates: [
      { contentid: "125800", label: "강릉 선교장 (관광지)" },
      { contentid: "1989501", label: "강릉선교장 (숙박업소로 등록)" },
    ],
  },
  {
    name: "하슬라아트월드",
    seedLat: 37.7065101,
    seedLon: 129.0099078,
    candidates: [
      { contentid: "127951", label: "하슬라아트월드 (관광지)" },
      { contentid: "1048785", label: "하슬라아트월드 (숙박업소로 등록)" },
    ],
  },
  {
    name: "연곡해변",
    seedLat: 37.8584845,
    seedLon: 128.8548181,
    candidates: [
      { contentid: "125698", label: "연곡해변(연곡해수욕장)" },
      { contentid: "2744417", label: "연곡해변솔향기캠핑장" },
    ],
  },
  {
    name: "강문해변",
    seedLat: 37.7948358,
    seedLon: 128.9193758,
    candidates: [
      { contentid: "585522", label: "강문해변" },
      { contentid: "3547899", label: "강문해변화장실" },
      { contentid: "3536360", label: "스타벅스 강릉강문해변점" },
    ],
  },
  {
    name: "안반데기",
    seedLat: 37.622629,
    seedLon: 128.7391555,
    candidates: [
      { contentid: "2930702", label: "강릉안반데기관광농원" },
      { contentid: "2714439", label: "안반데기 (이름 정확히 일치)" },
    ],
  },
  {
    name: "안목해변 커피거리",
    seedLat: 37.7723486,
    seedLon: 128.9476577,
    candidates: [{ contentid: "127722", label: "안목해변 (후보 1개)" }],
  },
  {
    name: "주문진수산시장",
    seedLat: 37.8910576,
    seedLon: 128.8277523,
    candidates: [{ contentid: "132774", label: "주문진수산시장 (후보 1개)" }],
  },
  {
    name: "송정해수욕장",
    seedLat: 37.7767843,
    seedLon: 128.9379875,
    candidates: [{ contentid: "126080", label: "송정해수욕장 (⚠️ 부산 동명 해변 있음, 위험도 높음)" }],
  },
  {
    name: "풍호마을",
    seedLat: 37.7386303,
    seedLon: 128.9544485,
    candidates: [{ contentid: "3069501", label: "풍호마을 (후보 1개)" }],
  },
  {
    name: "사천해변",
    seedLat: 37.8384299,
    seedLon: 128.8767884,
    candidates: [{ contentid: "125696", label: "사천해변 (후보 1개)" }],
  },
  {
    name: "초당순두부마을",
    seedLat: 37.7925599,
    seedLon: 128.9170172,
    candidates: [{ contentid: "264370", label: "초당순두부마을 (후보 1개)" }],
  },
  {
    name: "솔향대게",
    seedLat: 37.7907930,
    seedLon: 128.9204173,
    candidates: [{ contentid: "2685587", label: "솔향대게 (후보 1개)" }],
  },
  {
    name: "노추산 모정탑길",
    seedLat: 37.5711862,
    seedLon: 128.7395640,
    candidates: [{ contentid: "1869883", label: "노추산 모정탑길 (후보 1개)" }],
  },
];

function buildUrl(contentId) {
  return (
    `https://apis.data.go.kr/B551011/KorService2/detailCommon2` +
    `?serviceKey=${serviceKey}` +
    `&MobileOS=ETC` +
    `&MobileApp=gangneungflow` +
    `&_type=json` +
    `&contentId=${contentId}`
  );
}

// 위도 1도 ≈ 111.32km, 경도 1도 ≈ 약 88.1km (강릉 위도대 기준 근사치) — 체크인 반경(200m) 판단용 근사 계산
function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = (lat1 - lat2) * 111320;
  const dLon = (lon1 - lon2) * 88100;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const results = [];

  for (const place of PLACES) {
    console.log(`\n[${place.name}] 시드 좌표: ${place.seedLat}, ${place.seedLon}`);
    const candidateResults = [];

    for (const cand of place.candidates) {
      const url = buildUrl(cand.contentid);
      let item;
      let resultCode;
      let resultMsg;
      try {
        const res = await fetch(url);
        const data = await res.json();
        resultCode = data?.response?.header?.resultCode;
        resultMsg = data?.response?.header?.resultMsg;
        const items = data?.response?.body?.items;
        item = items && items !== "" ? (Array.isArray(items.item) ? items.item[0] : items.item) : null;
      } catch (err) {
        console.log(`  ${cand.label} (contentid=${cand.contentid}) → 요청 실패: ${err.message}`);
        candidateResults.push({ ...cand, error: err.message });
        await sleep(300);
        continue;
      }

      if (resultCode && resultCode !== "0000") {
        console.log(`  ${cand.label} (contentid=${cand.contentid}) → ⚠️ API 에러: ${resultMsg}`);
        candidateResults.push({ ...cand, apiError: { resultCode, resultMsg } });
        await sleep(300);
        continue;
      }

      if (!item) {
        console.log(`  ${cand.label} (contentid=${cand.contentid}) → 데이터 없음`);
        candidateResults.push({ ...cand, notFound: true });
        await sleep(300);
        continue;
      }

      const mapx = parseFloat(item.mapx);
      const mapy = parseFloat(item.mapy);
      const dist = distanceMeters(place.seedLat, place.seedLon, mapy, mapx);

      console.log(
        `  ${cand.label} (contentid=${cand.contentid}) → title="${item.title}" addr="${item.addr1 ?? ""}" mapx/mapy=${item.mapx}/${item.mapy} → 시드 좌표와 거리: 약 ${dist.toFixed(0)}m`
      );

      candidateResults.push({
        ...cand,
        title: item.title,
        addr1: item.addr1,
        mapx: item.mapx,
        mapy: item.mapy,
        distanceMeters: dist,
      });

      await sleep(300);
    }

    const valid = candidateResults.filter((c) => typeof c.distanceMeters === "number");
    const best = valid.length > 0 ? valid.reduce((a, b) => (a.distanceMeters < b.distanceMeters ? a : b)) : null;

    if (best) {
      console.log(`  → 추천: contentid=${best.contentid} (${best.label}, 약 ${best.distanceMeters.toFixed(0)}m)`);
    } else {
      console.log("  → 추천 불가 (유효한 후보 없음, 수동 확인 필요)");
    }

    results.push({ name: place.name, candidates: candidateResults, recommended: best });
  }

  console.log("\n\n========== 최종 추천 ==========");
  results.forEach((r) => {
    if (r.recommended) {
      console.log(`${r.name} → contentid=${r.recommended.contentid} (${r.recommended.label}, 약 ${r.recommended.distanceMeters.toFixed(0)}m)`);
    } else {
      console.log(`${r.name} → 추천 불가, 수동 확인 필요`);
    }
  });

  await writeFile("verify-candidates-result.json", JSON.stringify(results, null, 2), "utf-8");
  console.log("\n전체 결과를 verify-candidates-result.json 에 저장했습니다.");
}

main();
