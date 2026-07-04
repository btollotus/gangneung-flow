// 한국환경공단 EvCharger API zcode(지역구분 코드) 매핑표
// 출처: 한국환경공단_전기자동차_충전소_정보_OpenAPI활용가이드_v1_23, 3.4절 (2026-04-17 개정)
//
// ⚠️ 2026-07-01 전남광주통합특별시 출범(전라남도+광주광역시 통합)으로
// Kakao 좌표변환 API는 "전남광주통합특별시"를 반환하지만, EvCharger API는
// 2026-07-04 확인 결과 아직 통합 전 코드(46=전라남도, 29=광주광역시)를
// 개별 유지 중이다. 상위 지역명만으로는 구분이 안 되므로
// region_2depth_name(시/군/구)으로 옛 광주/전남 여부를 세분화 판별한다.

const ZCODE_MAP: Record<string, number> = {
    서울특별시: 11,
    부산광역시: 26,
    대구광역시: 27,
    인천광역시: 28,
    광주광역시: 29,
    대전광역시: 30,
    울산광역시: 31,
    세종특별자치시: 36,
    경기도: 41,
    충청북도: 43,
    충청남도: 44,
    전라남도: 46,
    경상북도: 47,
    경상남도: 48,
    제주특별자치도: 50,
    강원특별자치도: 51,
    전북특별자치도: 52,
  };
  
  // 2026-06-30까지 광주광역시 소속이었던 5개 구 (통합 후에도 EvCharger API는
  // 이 구들을 zcode=29로 유지 중임을 2026-07-04 실측 확인함)
  const GWANGJU_GU = new Set(["동구", "서구", "남구", "북구", "광산구"]);
  
  export function resolveZcode(region1: string, region2: string): number | null {
    if (region1 === "전남광주통합특별시") {
      return GWANGJU_GU.has(region2) ? 29 : 46;
    }
  
    return ZCODE_MAP[region1] ?? null;
  }