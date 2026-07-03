"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// 강릉시 주차장 실시간정보 API — 이미 인코딩된 서비스키를 raw string으로 이어붙임 (이중 인코딩 방지)
const SERVICE_KEY = process.env.GN_ITS_API_KEY;
const BASE = "https://apis.data.go.kr/4201000/GNitsTrafficInfoService_1.0";

export interface NearbyParkingLot {
  prkId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  parkType: string | null;
  distanceMeters: number;
  weekOpenTime: string | null;
  weekEndTime: string | null;
  satOpenTime: string | null;
  satEndTime: string | null;
  holiOpenTime: string | null;
  holiEndTime: string | null;
  // 실시간 정보는 API 호출 실패 시 null일 수 있다 (기본정보는 항상 반환)
  totalLots: number | null;
  availLots: number | null;
}

// Haversine 공식으로 두 지점 간 거리(미터) 계산
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 지구 반지름(m)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// getParkRltm 실시간 가용면수 조회. DB 캐싱 없이 매 요청 시 API 직접 호출 (CCTV와 동일 설계).
// ⚠️ dataType 파라미터를 보내면 빈 응답이 오므로 절대 포함하지 않는다 (13차 세션에서 확인된 사실).
async function fetchRealtimeAvailability(): Promise<
  Map<string, { totalLots: number; availLots: number }>
> {
  const map = new Map<string, { totalLots: number; availLots: number }>();

  if (!SERVICE_KEY) {
    console.error("parking.ts: GN_ITS_API_KEY가 설정되지 않았습니다.");
    return map;
  }

  try {
    const params = { pageNo: 1, numOfRows: 100 };
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    const url = `${BASE}/getParkRltm?serviceKey=${SERVICE_KEY}&${query}`;

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (res.status !== 200) {
      console.error(
        `parking.ts: getParkRltm 요청 실패 (상태 코드 ${res.status}): ${text}`
      );
      return map;
    }

    const json = JSON.parse(text);

    if (json.header?.resultCode !== "00") {
      console.error(
        `parking.ts: getParkRltm 응답 오류: ${json.header?.resultMsg ?? "알 수 없는 오류"}`
      );
      return map;
    }

    const items = json.body?.items?.item ?? [];
    for (const item of items) {
      if (!item.prkId) continue;
      map.set(item.prkId, {
        totalLots: Number(item.totalLots),
        availLots: Number(item.availLots),
      });
    }
  } catch (err) {
    console.error("parking.ts: getParkRltm 호출 중 예외 발생:", err);
    // 실시간 정보 실패해도 기본정보는 반환할 수 있도록 빈 맵 반환 (에러를 던지지 않음)
  }

  return map;
}

/**
 * 주어진 위경도 기준 반경(기본 500m) 내 주차장을 거리순으로 반환한다.
 * - 기본정보는 parking_lots 테이블(DB)에서, 실시간 가용면수는 매 요청 시 API 직접 호출로 가져와 조합한다.
 * - places 테이블 스키마에 의존하지 않는다 — 호출하는 쪽이 위경도를 직접 넘긴다.
 * - "주변 정보 탭"과 "장소 상세 근처 정보" 양쪽에서 공통으로 사용하는 함수.
 */
export async function getNearbyParkingLots(
  lat: number,
  lng: number,
  radiusMeters = 500
): Promise<NearbyParkingLot[]> {
  const admin = createAdminClient();

  const { data: lots, error } = await admin
    .from("parking_lots")
    .select(
      "prk_id, name, address, lat, lng, park_type, week_open_time, week_end_time, sat_open_time, sat_end_time, holi_open_time, holi_end_time"
    );

  if (error) {
    console.error("parking.ts: parking_lots 조회 오류:", error.message);
    return [];
  }

  if (!lots || lots.length === 0) {
    return [];
  }

  const withDistance = lots
    .filter((lot) => lot.lat != null && lot.lng != null)
    .map((lot) => ({
      ...lot,
      distanceMeters: haversineMeters(
        lat,
        lng,
        Number(lot.lat),
        Number(lot.lng)
      ),
    }))
    .filter((lot) => lot.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (withDistance.length === 0) {
    return [];
  }

  const realtime = await fetchRealtimeAvailability();

  return withDistance.map((lot) => {
    const rt = realtime.get(lot.prk_id);
    return {
      prkId: lot.prk_id,
      name: lot.name,
      address: lot.address,
      lat: Number(lot.lat),
      lng: Number(lot.lng),
      parkType: lot.park_type,
      distanceMeters: Math.round(lot.distanceMeters),
      weekOpenTime: lot.week_open_time,
      weekEndTime: lot.week_end_time,
      satOpenTime: lot.sat_open_time,
      satEndTime: lot.sat_end_time,
      holiOpenTime: lot.holi_open_time,
      holiEndTime: lot.holi_end_time,
      totalLots: rt?.totalLots ?? null,
      availLots: rt?.availLots ?? null,
    };
  });
}
