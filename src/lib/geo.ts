// 체크인(checkin/actions.ts)과 경험 공유(experience/actions.ts) 양쪽에서 동일한 기준으로
// "근처 장소" 판정을 해야 하므로 거리 계산 로직을 여기 하나로 통일한다.

export const CHECKIN_RADIUS_METERS = 200

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
