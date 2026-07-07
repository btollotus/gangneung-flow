// sync-travel-photos.mjs
// 한국관광공사 "관광공모전(사진) 수상작 정보" API → Supabase travel_award_photos 테이블 동기화
//
// 실행: node sync-travel-photos.mjs
//
// 필요 환경변수 (.env 또는 실행 환경에 설정):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   ← service_role 키 (anon 키 아님, RLS 우회 필요)
//   TOUR_API_SERVICE_KEY        ← 공공데이터포털 "Encoding" 인증키 (Decoding 키 아님 — 과거 TourAPI 인증 실패 이슈 참고)
//
// 참고: showflag=1(표출 대상)인 항목만 동기화. 지역코드(lDongRegnCd)로 필터링하지 않음 —
//       일부 항목은 lDongRegnCd가 빈 문자열이라 지역 필터를 걸면 통째로 누락되는 것을 실측으로 확인함
//       (예: "단풍 물든 설악산 주전골", "군산 옥녀교차로 청보리밭" 등).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOUR_API_SERVICE_KEY = process.env.TOUR_API_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TOUR_API_SERVICE_KEY) {
  console.error("필수 환경변수 누락: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TOUR_API_SERVICE_KEY 확인 필요");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const API_BASE = "https://apis.data.go.kr/B551011/PhokoAwrdService";
const PAGE_SIZE = 100; // 확인된 전체 건수(95건) 대비 여유 있게 설정

async function fetchAllPhotos() {
  const allItems = [];
  let pageNo = 1;

  while (true) {
    const url =
      `${API_BASE}/phokoAwrdSyncList` +
      `?serviceKey=${TOUR_API_SERVICE_KEY}` +
      `&numOfRows=${PAGE_SIZE}` +
      `&pageNo=${pageNo}` +
      `&MobileOS=ETC` +
      `&MobileApp=GangneungFlow` +
      `&arrange=C` +
      `&showflag=1` +
      `&_type=json`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API 요청 실패: HTTP ${res.status}`);
    }

    const json = await res.json();
    const header = json?.response?.header;
    if (header?.resultCode !== "0000") {
      throw new Error(`API 응답 오류: ${header?.resultCode} ${header?.resultMsg}`);
    }

    const body = json?.response?.body;
    const totalCount = body?.totalCount ?? 0;
    const items = body?.items?.item;

    // items가 빈 문자열("")로 오는 경우(결과 0건) 대비
    const itemArray = Array.isArray(items) ? items : items ? [items] : [];

    allItems.push(...itemArray);

    console.log(`페이지 ${pageNo} 조회: ${itemArray.length}건 (누적 ${allItems.length}/${totalCount})`);

    if (allItems.length >= totalCount || itemArray.length === 0) {
      break;
    }
    pageNo += 1;
  }

  return allItems;
}

function mapToRow(item) {
  return {
    content_id: item.contentId,
    ko_title: item.koTitle ?? null,
    en_title: item.enTitle ?? null,
    ldong_regn_cd: item.lDongRegnCd || null, // 빈 문자열 → null로 정규화
    ko_filmst: item.koFilmst ?? null,
    en_filmst: item.enFilmst ?? null,
    film_day: item.filmDay ?? null,
    ko_cman_nm: item.koCmanNm ?? null,
    en_cman_nm: item.enCmanNm ?? null,
    ko_wnprz_diz: item.koWnprzDiz ?? null,
    en_wnprz_diz: item.enWnprzDiz ?? null,
    ko_keyword: item.koKeyWord ?? null,
    en_keyword: item.enKeyWord ?? null,
    org_image: item.orgImage ?? null,
    thumb_image: item.thumbImage ?? null,
    cpyrht_div_cd: item.cpyrhtDivCd ?? null,
    reg_dt: item.regDt ?? null,
    mdfcn_dt: item.mdfcnDt ?? null,
    showflag: item.showflag === undefined ? true : item.showflag === "1" || item.showflag === 1,
    // synced_at은 DB default now()에 맡김 — 코드에서 직접 입력하지 않음
  };
}

async function main() {
  console.log("관광공모전(사진) 수상작 동기화 시작...");

  const items = await fetchAllPhotos();
  console.log(`총 ${items.length}건 조회 완료. Supabase upsert 시작...`);

  if (items.length === 0) {
    console.log("동기화할 항목이 없습니다. 종료합니다.");
    return;
  }

  const rows = items.map(mapToRow);

  // contentId 기준 upsert (신규는 insert, 기존은 update)
  const { error, count } = await supabase
    .from("travel_award_photos")
    .upsert(rows, { onConflict: "content_id", count: "exact" });

  if (error) {
    console.error("Supabase upsert 오류:", error.message);
    process.exit(1);
  }

  console.log(`동기화 완료: ${count ?? rows.length}건 upsert 성공`);

  // 검증: 실제 저장된 건수 별도 확인 (Supabase "Success. No rows returned" 패턴 주의 원칙)
  const { count: dbCount, error: countError } = await supabase
    .from("travel_award_photos")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("검증 조회 오류:", countError.message);
  } else {
    console.log(`DB 실제 저장 건수 확인: ${dbCount}건`);
  }
}

main().catch((err) => {
  console.error("동기화 실패:", err);
  process.exit(1);
});
