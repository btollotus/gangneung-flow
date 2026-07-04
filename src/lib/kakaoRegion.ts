"use server";

// Kakao 로컬 API - 좌표를 시/도, 시/군/구 행정구역명으로 변환
// 응답 필드는 공식 문서로 확인 완료 (region_1depth_name, region_2depth_name 등)

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";

export interface RegionInfo {
  region1: string; // 시/도
  region2: string; // 시/군/구
}

export async function getRegionFromCoords(
  lat: number,
  lng: number
): Promise<RegionInfo | null> {
  if (!KAKAO_REST_API_KEY) {
    console.error("kakaoRegion.ts: KAKAO_REST_API_KEY가 설정되지 않았습니다.");
    return null;
  }

  try {
    const url = `${URL}?x=${lng}&y=${lat}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      cache: "no-store",
    });

    if (res.status !== 200) {
      const text = await res.text();
      console.error(
        `kakaoRegion.ts: coord2regioncode 요청 실패 (상태 코드 ${res.status}): ${text}`
      );
      return null;
    }

    const json = await res.json();
    const documents = json.documents ?? [];
    // region_type "H"(행정동) 우선, 없으면 "B"(법정동) 사용
    const doc =
      documents.find((d: { region_type: string }) => d.region_type === "H") ??
      documents[0];

    if (!doc) return null;

    return {
      region1: doc.region_1depth_name,
      region2: doc.region_2depth_name,
    };
  } catch (err) {
    console.error("kakaoRegion.ts: coord2regioncode 호출 중 예외 발생:", err);
    return null;
  }
}