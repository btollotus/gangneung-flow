"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRegionFromCoords } from "@/lib/kakaoRegion";
import { resolveZcode } from "@/lib/zcode";

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

// 반경 내 결과가 0건일 때 노출할 최근접 1곳 fallback.
// getNearbyChargers와 달리 BOX_DELTA/radius 필터 없이 전체 테이블을 대상으로 한다.
// (2026-07-04 추가 — 기존 getNearbyChargers 로직은 변경하지 않음)
export interface NearestChargerFallback {
  statId: string;
  name: string;
  distanceMeters: number;
}

export async function getNearestChargerFallback(
  lat: number,
  lng: number
): Promise<NearestChargerFallback | null> {
  const admin = createAdminClient();

  const { data: chargers, error } = await admin
    .from("ev_chargers")
    .select("stat_id, stat_nm, lat, lng");

  if (error) {
    console.error("evCharger.ts: getNearestChargerFallback 조회 오류:", error.message);
    return null;
  }

  if (!chargers || chargers.length === 0) {
    return null;
  }

  let nearest: NearestChargerFallback | null = null;

  for (const c of chargers) {
    if (c.lat == null || c.lng == null) continue;
    const distanceMeters = haversineMeters(lat, lng, Number(c.lat), Number(c.lng));
    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = {
        statId: c.stat_id,
        name: c.stat_nm,
        distanceMeters: Math.round(distanceMeters),
      };
    }
  }

  return nearest;
}

// 강원 외 지역은 DB에 데이터가 없으므로, 실시간 API로 해당 시/도만 조회한다.
// 강릉(강원, zcode=51)은 기존 getNearbyChargers(DB 기반, 더 빠름)를 그대로 사용.
export async function getChargersByLocation(
  lat: number,
  lng: number
): Promise<{ zcodeResolved: boolean; chargers: NearbyChargerStation[] }> {
    const region = await getRegionFromCoords(lat, lng);

    if (!region) {
      return { zcodeResolved: false, chargers: [] };
    }
  
    const zcode = resolveZcode(region.region1, region.region2);
  
    console.log(
      `evCharger.ts: getChargersByLocation 호출 — lat=${lat}, lng=${lng}, region1="${region.region1}", region2="${region.region2}", zcode=${zcode}`
    );
  
    if (zcode === null) {
      return { zcodeResolved: false, chargers: [] };
    }

  // 강원 지역은 기존 DB 기반 함수가 더 빠르고 이미 검증되어 있으므로 그대로 재사용
  if (zcode === 51) {
    const chargers = await getNearbyChargers(lat, lng, 5000);
    return { zcodeResolved: true, chargers };
  }

  if (!SERVICE_KEY) {
    console.error("evCharger.ts: GN_ITS_API_KEY가 설정되지 않았습니다.");
    return { zcodeResolved: true, chargers: [] };
  }

  try {
    const infoUrl = `${BASE}/getChargerInfo?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=9999&zcode=${zcode}&dataType=JSON`;
    const res = await fetch(infoUrl, { cache: "no-store" });
    const text = await res.text();

    if (res.status !== 200) {
      console.error(
        `evCharger.ts: getChargerInfo(zcode=${zcode}) 요청 실패 (상태 코드 ${res.status}): ${text}`
      );
      return { zcodeResolved: true, chargers: [] };
    }

    const json = JSON.parse(text);

    if (json.resultCode !== "00") {
      console.error(
        `evCharger.ts: getChargerInfo(zcode=${zcode}) 응답 오류: ${json.resultMsg ?? "알 수 없는 오류"}`
      );
      return { zcodeResolved: true, chargers: [] };
    }

    const items = json.items?.item ?? [];

    if (items.length === 0) {
      // API 자체는 정상이나 해당 지역 데이터가 없는 경우
      // (2026-07-04 확인: zcode=46(전라남도)이 이 상태 — 통합 전 코드
      // 체계 과도기로 추정. 에러가 아닌 정상적인 "데이터 없음"으로 처리)
      return { zcodeResolved: true, chargers: [] };
    }

    const withDistance = items
      .filter((i: { lat?: string; lng?: string }) => i.lat && i.lng)
      .map((i: Record<string, string>) => ({
        ...i,
        distanceMeters: haversineMeters(lat, lng, Number(i.lat), Number(i.lng)),
      }))
      .sort(
        (a: { distanceMeters: number }, b: { distanceMeters: number }) =>
          a.distanceMeters - b.distanceMeters
      );

    // 진단용: 이름+주소가 같은데 statId가 다른 경우가 있는지 확인 (2026-07-05)
    const nameAddrMap = new Map<string, Set<string>>();
    for (const c of withDistance) {
      const key = `${c.statNm}__${c.addr}`;
      if (!nameAddrMap.has(key)) nameAddrMap.set(key, new Set());
      nameAddrMap.get(key)!.add(c.statId);
    }
    for (const [key, statIds] of nameAddrMap) {
      if (statIds.size > 1) {
        console.log(
          `evCharger.ts: [중복의심] "${key}" → statId 목록: ${Array.from(statIds).join(", ")}`
        );
      }
    }

    const grouped = new Map<string, NearbyChargerStation>();

    for (const c of withDistance) {
      const unit: ChargerUnit = {
        chgerId: c.chgerId,
        chgerType: c.chgerType,
        output: c.output,
        stat: c.stat ?? null,
        statLabel: c.stat ? STAT_LABELS[c.stat] ?? "상태미확인" : "실시간 정보 없음",
      };

      const existing = grouped.get(c.statId);
      if (existing) {
        existing.chargers.push(unit);
      } else {
        grouped.set(c.statId, {
          statId: c.statId,
          name: c.statNm,
          address: c.addr,
          lat: Number(c.lat),
          lng: Number(c.lng),
          parkingFree: c.parkingFree,
          useTime: c.useTime,
          distanceMeters: Math.round(c.distanceMeters),
          chargers: [unit],
        });
      }
    }

    const stations = Array.from(grouped.values())
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 10);

    return { zcodeResolved: true, chargers: stations };
  } catch (err) {
    console.error(`evCharger.ts: getChargerInfo(zcode=${zcode}) 호출 중 예외 발생:`, err);
    return { zcodeResolved: true, chargers: [] };
  }
}