"use server";

const SERVICE_KEY = process.env.TOUR_API_KEY;
const BASE = "https://apis.data.go.kr/B551011/KorService2";

export interface NearbyRestaurant {
  contentId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  distanceMeters: number;
  isCafe: boolean;
  image: string | null;
}

// TourAPI locationBasedList2는 서버에서 dist(m)를 직접 계산해 반환하고,
// arrange=E로 요청하면 거리 오름차순 정렬까지 서버가 처리한다
// (2026-07-06 실측 확인: 강릉 시내 좌표 기준 dist 값 83m~544m 정상 반환, 오름차순 정렬 확인).
export async function getNearbyRestaurants(
  lat: number,
  lng: number,
  radiusMeters = 2000
): Promise<{ restaurants: NearbyRestaurant[]; error: boolean }> {
  if (!SERVICE_KEY) {
    console.error("restaurants.ts: TOUR_API_KEY가 설정되지 않았습니다.");
    return { restaurants: [], error: true };
  }

  try {
    const params: Record<string, string | number> = {
      serviceKey: SERVICE_KEY,
      numOfRows: 30,
      pageNo: 1,
      MobileOS: "ETC",
      MobileApp: "gangneungflow",
      _type: "json",
      contentTypeId: 39,
      mapX: lng,
      mapY: lat,
      radius: radiusMeters,
      arrange: "E",
    };
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    const url = `${BASE}/locationBasedList2?${query}`;

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (res.status !== 200) {
      console.error(
        `restaurants.ts: locationBasedList2 요청 실패 (상태 코드 ${res.status}): ${text}`
      );
      return { restaurants: [], error: true };
    }

    const json = JSON.parse(text);

    if (json.response?.header?.resultCode !== "0000") {
      console.error(
        `restaurants.ts: locationBasedList2 응답 오류: ${
          json.response?.header?.resultMsg ?? "알 수 없는 오류"
        }`
      );
      return { restaurants: [], error: true };
    }

    const items = json.response?.body?.items?.item ?? [];

    const restaurants: NearbyRestaurant[] = items
      .filter((i: Record<string, string>) => i.mapy && i.mapx)
      .map((i: Record<string, string>) => ({
        contentId: i.contentid,
        name: i.title,
        address: i.addr1 || null,
        lat: Number(i.mapy),
        lng: Number(i.mapx),
        distanceMeters: Math.round(Number(i.dist ?? 0)),
        // FD05 = 카페/찻집 대분류. 별도 API 호출 없이 lclsSystm2 값으로 클라이언트에서
        // 음식점/카페 탭을 구분한다 (2026-07-06 실측 확인: lclsSystm3=FD050100 서버 필터도
        // 정상 작동하지만, 왕복 호출을 늘리지 않기 위해 단일 호출 결과를 재사용).
        isCafe: i.lclsSystm2 === "FD05",
        image: i.firstimage || null,
      }));

    return { restaurants, error: false };
  } catch (err) {
    console.error("restaurants.ts: locationBasedList2 호출 중 예외 발생:", err);
    return { restaurants: [], error: true };
  }
}