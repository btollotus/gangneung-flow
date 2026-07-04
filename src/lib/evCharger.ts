"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const SERVICE_KEY = process.env.GN_ITS_API_KEY;
const BASE = "https://apis.data.go.kr/B552584/EvCharger";

const STAT_LABELS: Record<string, string> = {
  "2": "대기중",
  "3": "충전중",
  "4": "고장/점검",
  "9": "상태미확인",
};

// 충전소 하나에 딸린 개별 충전기 1대 (같은 statId 아래 chgerId가 여러 개 있을 수 있음)
export interface ChargerUnit {
    chgerId: string;
    chgerType: string | null;
    output: string | null;
    stat: string | null;
    statLabel: string;
  }
  
  // 충전소 1곳 = 카드 1개. 충전기가 여러 대여도 이름/주소/거리는 한 번만 표시하고
  // 개별 충전기는 chargers 배열에 묶는다 (같은 주소가 반복 표시되던 문제 해결, 2026-07-04).
  export interface NearbyChargerStation {
    statId: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
    parkingFree: string | null;
    useTime: string | null;
    distanceMeters: number;
    chargers: ChargerUnit[];
  }

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ⚠️ getChargerStatus는 zscode(시/군) 미지원, zcode(도)만 지원 — 강원도 전체를 받아온 뒤 클라이언트에서 매칭한다.
// (2026-07-04 확인: 강원도 전체 totalCount=831건, 한 번의 호출로 전부 수신 가능한 크기)
async function fetchRealtimeStatus(): Promise<
  Map<string, { stat: string; statUpdDt: string }>
> {
  const map = new Map<string, { stat: string; statUpdDt: string }>();

  if (!SERVICE_KEY) {
    console.error("evCharger.ts: GN_ITS_API_KEY가 설정되지 않았습니다.");
    return map;
  }

  try {
    const params = { pageNo: 1, numOfRows: 1000, zcode: 51, dataType: "JSON" };
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    const url = `${BASE}/getChargerStatus?serviceKey=${SERVICE_KEY}&${query}`;

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (res.status !== 200) {
      console.error(
        `evCharger.ts: getChargerStatus 요청 실패 (상태 코드 ${res.status}): ${text}`
      );
      return map;
    }

    const json = JSON.parse(text);

    // ⚠️ 이 API는 header/body 래핑이 없는 flat 구조 (parking API와 다름)
    if (json.resultCode !== "00") {
      console.error(
        `evCharger.ts: getChargerStatus 응답 오류: ${json.resultMsg ?? "알 수 없는 오류"}`
      );
      return map;
    }

    const items = json.items?.item ?? [];
    const totalCount = json.totalCount ?? 0;

    if (items.length < totalCount) {
      console.warn(
        `evCharger.ts: getChargerStatus 수신 건수(${items.length})가 totalCount(${totalCount})보다 적습니다. numOfRows를 늘려야 할 수 있습니다.`
      );
    }

    for (const item of items) {
      if (!item.statId || !item.chgerId) continue;
      map.set(`${item.statId}_${item.chgerId}`, {
        stat: item.stat,
        statUpdDt: item.statUpdDt,
      });
    }
  } catch (err) {
    console.error("evCharger.ts: getChargerStatus 호출 중 예외 발생:", err);
  }

  return map;
}

export async function getNearbyChargers(
  lat: number,
  lng: number,
  radiusMeters = 500
): Promise<NearbyChargerStation[]> {
  const admin = createAdminClient();

  const BOX_DELTA = 0.01; // 약 1.1km — Haversine 정밀 필터 전 1차 후보군 축소용

  const { data: chargers, error } = await admin
    .from("ev_chargers")
    .select(
      "stat_id, chger_id, stat_nm, addr, lat, lng, chger_type, output, parking_free, use_time"
    )
    .gte("lat", lat - BOX_DELTA)
    .lte("lat", lat + BOX_DELTA)
    .gte("lng", lng - BOX_DELTA)
    .lte("lng", lng + BOX_DELTA);

  if (error) {
    console.error("evCharger.ts: ev_chargers 조회 오류:", error.message);
    return [];
  }

  if (!chargers || chargers.length === 0) {
    return [];
  }

  const withDistance = chargers
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({
      ...c,
      distanceMeters: haversineMeters(lat, lng, Number(c.lat), Number(c.lng)),
    }))
    .filter((c) => c.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (withDistance.length === 0) {
    return [];
  }

  const realtime = await fetchRealtimeStatus();

  // 같은 충전소(stat_id) 안의 여러 충전기(chger_id)를 카드 1개로 묶는다
  // (수정 전에는 충전기 대수만큼 같은 이름/주소가 반복 표시되던 문제 — 2026-07-04 확인)
  const grouped = new Map<string, NearbyChargerStation>();

  for (const c of withDistance) {
    const rt = realtime.get(`${c.stat_id}_${c.chger_id}`);
    const unit: ChargerUnit = {
      chgerId: c.chger_id,
      chgerType: c.chger_type,
      output: c.output,
      stat: rt?.stat ?? null,
      statLabel: rt?.stat ? STAT_LABELS[rt.stat] ?? "상태미확인" : "실시간 정보 없음",
    };

    const existing = grouped.get(c.stat_id);
    if (existing) {
      existing.chargers.push(unit);
    } else {
      grouped.set(c.stat_id, {
        statId: c.stat_id,
        name: c.stat_nm,
        address: c.addr,
        lat: Number(c.lat),
        lng: Number(c.lng),
        parkingFree: c.parking_free,
        useTime: c.use_time,
        distanceMeters: Math.round(c.distanceMeters),
        chargers: [unit],
      });
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => a.distanceMeters - b.distanceMeters
  );
}