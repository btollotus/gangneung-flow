// scripts/collect-place-details.mjs
// 목적: places-contentid-mapping.json의 confirmed(22곳)에 대해
//       detailCommon2(설명/주소) + detailImage2(사진 목록)를 일괄 수집.
//       DB(places 테이블)에는 쓰지 않음 — 콘솔 출력 + JSON 파일 저장만.
// 실행: node --env-file=.env.local scripts/collect-place-details.mjs
//
// 검증된 패턴: detailCommon2/detailImage2 모두 contentId 외 파라미터 받지 않음.
// 같은 contentid를 가진 장소(강릉월화거리/월화거리야시장)는 캐시로 중복 호출 방지.

import { readFile, writeFile } from "node:fs/promises";

const serviceKey = process.env.TOUR_API_SERVICE_KEY;
if (!serviceKey) {
  console.error("TOUR_API_SERVICE_KEY가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}

const MAPPING_PATH = "scripts/data/places-contentid-mapping.json";
const OUTPUT_PATH = "scripts/data/place-details-result.json";

function buildCommonUrl(contentId) {
  return (
    `https://apis.data.go.kr/B551011/KorService2/detailCommon2` +
    `?serviceKey=${serviceKey}` +
    `&MobileOS=ETC` +
    `&MobileApp=gangneungflow` +
    `&_type=json` +
    `&contentId=${contentId}`
  );
}

function buildImageUrl(contentId) {
  return (
    `https://apis.data.go.kr/B551011/KorService2/detailImage2` +
    `?serviceKey=${serviceKey}` +
    `&MobileOS=ETC` +
    `&MobileApp=gangneungflow` +
    `&_type=json` +
    `&contentId=${contentId}`
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCommon(contentId) {
  try {
    const res = await fetch(buildCommonUrl(contentId));
    const data = await res.json();
    const resultCode = data?.response?.header?.resultCode;
    const resultMsg = data?.response?.header?.resultMsg;
    if (resultCode !== "0000") {
      return { error: `${resultCode}: ${resultMsg}` };
    }
    const items = data?.response?.body?.items;
    const item = items && items !== "" ? (Array.isArray(items.item) ? items.item[0] : items.item) : null;
    if (!item) return { error: "데이터 없음" };
    return {
      title: item.title,
      overview: item.overview ?? "",
      addr1: item.addr1 ?? "",
      addr2: item.addr2 ?? "",
      firstimage: item.firstimage ?? "",
    };
  } catch (err) {
    return { error: `요청 실패: ${err.message}` };
  }
}

async function fetchImages(contentId) {
  try {
    const res = await fetch(buildImageUrl(contentId));
    const data = await res.json();
    const resultCode = data?.response?.header?.resultCode;
    if (resultCode !== "0000") return [];
    const items = data?.response?.body?.items;
    if (!items || items === "") return [];
    const list = Array.isArray(items.item) ? items.item : [items.item];
    return list.map((it) => it.originimgurl).filter(Boolean);
  } catch {
    return [];
  }
}

async function main() {
  const mapping = JSON.parse(await readFile(MAPPING_PATH, "utf-8"));
  const confirmedPlaces = mapping.places.filter((p) => p.status === "confirmed");

  console.log(`확정된 ${confirmedPlaces.length}곳에 대해 수집을 시작합니다.\n`);

  const cache = new Map(); // contentid -> { common, images }
  const results = [];

  for (const place of confirmedPlaces) {
    const cid = place.contentid;
    let cached = cache.get(cid);

    if (cached) {
      console.log(`[캐시 재사용] ${place.name} (contentid=${cid}) — 이미 조회한 contentid`);
    } else {
      console.log(`[조회] ${place.name} (contentid=${cid})`);
      const common = await fetchCommon(cid);
      await sleep(300);
      const images = await fetchImages(cid);
      await sleep(300);
      cached = { common, images };
      cache.set(cid, cached);
    }

    if (cached.common.error) {
      console.log(`  ⚠️ 에러: ${cached.common.error}`);
    } else {
      const overview = cached.common.overview ?? "";
      const preview = overview.slice(0, 60).replace(/\n/g, " ");
      console.log(
        `  설명 길이=${overview.length}자, 이미지=${cached.images.length}장`
      );
      console.log(`  미리보기: ${preview}${overview.length > 60 ? "..." : ""}`);
    }

    results.push({
      name: place.name,
      tier: place.tier,
      contentid: cid,
      description: cached.common.error ? null : cached.common.overview || null,
      address: cached.common.error
        ? null
        : [cached.common.addr1, cached.common.addr2].filter(Boolean).join(" ") || null,
      image_url: cached.images[0] ?? (cached.common.error ? null : cached.common.firstimage || null),
      all_images: cached.images,
      error: cached.common.error ?? null,
    });

    console.log("");
  }

  console.log("\n========== 수집 요약 ==========");
  const errored = results.filter((r) => r.error);
  const noDescription = results.filter((r) => !r.error && !r.description);
  const noImage = results.filter((r) => !r.error && !r.image_url);

  console.log(`에러 난 곳 (${errored.length}곳):`);
  errored.forEach((r) => console.log(`  - ${r.name}: ${r.error}`));

  console.log(`\n설명(overview)이 없는 곳 (${noDescription.length}곳):`);
  noDescription.forEach((r) => console.log(`  - ${r.name}`));

  console.log(`\n이미지가 없는 곳 (${noImage.length}곳):`);
  noImage.forEach((r) => console.log(`  - ${r.name}`));

  await writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n전체 결과를 ${OUTPUT_PATH} 에 저장했습니다.`);
}

main();
