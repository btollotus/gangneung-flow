'use server'

// Kakao 로컬 API - 키워드로 장소(업체) 검색. kakaoRegion.ts와 동일한 REST API 키 재사용.
// 경험 공유 게시물 업로드 시, GPS 반경 안에 31개 지정 장소가 없을 때
// 사용자가 직접 업체명을 검색해서 주소/좌표를 채워 넣는 용도.

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY
const URL = 'https://dapi.kakao.com/v2/local/search/keyword.json'

export interface PlaceCandidate {
  name: string
  address: string
  latitude: number
  longitude: number
}

export async function searchKakaoPlace(query: string): Promise<PlaceCandidate[]> {
  if (!KAKAO_REST_API_KEY) {
    console.error('kakaoPlaceSearch.ts: KAKAO_REST_API_KEY가 설정되지 않았습니다.')
    return []
  }

  const trimmed = query.trim()
  if (!trimmed) return []

  try {
    // 강릉 지역 검색 정확도를 높이기 위해 중심좌표(강릉 시청 인근) 기준 근접 정렬
    const url = `${URL}?query=${encodeURIComponent(trimmed)}&x=128.8761&y=37.7519&radius=20000&sort=distance&size=8`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      cache: 'no-store',
    })

    if (res.status !== 200) {
      const text = await res.text()
      console.error(`kakaoPlaceSearch.ts: 검색 요청 실패 (상태 코드 ${res.status}): ${text}`)
      return []
    }

    const json = await res.json()
    const documents = json.documents ?? []

    return documents.map(
      (d: {
        place_name: string
        road_address_name: string
        address_name: string
        y: string
        x: string
      }) => ({
        name: d.place_name,
        address: d.road_address_name || d.address_name,
        latitude: Number(d.y),
        longitude: Number(d.x),
      })
    )
  } catch (err) {
    console.error('kakaoPlaceSearch.ts: 검색 호출 중 예외 발생:', err)
    return []
  }
}
