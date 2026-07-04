'use client'

import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import type { CheckinPlace } from './page'
import { confirmVisit } from './actions'
import { getNearbyParkingLots, type NearbyParkingLot } from '@/lib/parking'
import { getNearbyChargers, type NearbyCharger } from '@/lib/evCharger'

type LocationState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ready'; latitude: number; longitude: number }

const CHECKIN_RADIUS_METERS = 200

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // 지구 반지름(m)
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export default function CheckinList({ places }: { places: CheckinPlace[] }) {
  const [location, setLocation] = useState<LocationState>({ status: 'loading' })
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 근처 주차장 — 카드별 펼침/캐시/로딩/에러 상태 (체크인 로직과 독립적으로 관리)
  const [expandedParkingId, setExpandedParkingId] = useState<string | null>(null)
  const [parkingCache, setParkingCache] = useState<Record<string, NearbyParkingLot[]>>({})
  const [parkingLoadingId, setParkingLoadingId] = useState<string | null>(null)
  const [parkingErrors, setParkingErrors] = useState<Record<string, string>>({})

  // 근처 충전소 — 카드별 펼침/캐시/로딩/에러 상태 (주차장 로직과 동일한 패턴, 완전히 독립적으로 관리)
  const [expandedChargerId, setExpandedChargerId] = useState<string | null>(null)
  const [chargerCache, setChargerCache] = useState<Record<string, NearbyCharger[]>>({})
  const [chargerLoadingId, setChargerLoadingId] = useState<string | null>(null)
  const [chargerErrors, setChargerErrors] = useState<Record<string, string>>({})

    // 주소 복사 피드백 (장소/주차장/충전소 공용, key로 구분)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ status: 'error', message: '이 기기에서는 위치 기능을 사용할 수 없어요.' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          status: 'ready',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocation({ status: 'denied' })
        } else {
          setLocation({ status: 'error', message: '위치를 가져오지 못했어요. 다시 시도해주세요.' })
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  if (location.status === 'loading') {
    return <p className="text-sm text-ink/60">📍 위치를 확인하는 중이에요...</p>
  }

  if (location.status === 'denied') {
    return (
      <p className="text-sm text-ink/60">
        위치 권한이 필요해요. 브라우저 설정에서 위치 접근을 허용한 뒤 새로고침해주세요.
      </p>
    )
  }

  if (location.status === 'error') {
    return <p className="text-sm text-ink/60">{location.message}</p>
  }

  const placesWithDistance = places
    .map((place) => ({
      ...place,
      distance: haversineDistanceMeters(
        location.latitude,
        location.longitude,
        place.latitude,
        place.longitude
      ),
    }))
    .sort((a, b) => a.distance - b.distance)

  const handleConfirm = async (placeId: string) => {
    setErrorMessage(null)
    setConfirmingId(placeId)

    const result = await confirmVisit(placeId, location.latitude, location.longitude)

    setConfirmingId(null)

    if (result.success) {
      setConfirmedIds((prev) => new Set(prev).add(placeId))
    } else {
      setErrorMessage(result.error)
    }
  }

  const handleToggleParking = async (place: CheckinPlace) => {
    if (expandedParkingId === place.id) {
      setExpandedParkingId(null)
      return
    }

    setExpandedParkingId(place.id)

    // 이미 조회한 적 있으면 재호출하지 않음 (실시간 API 불필요한 재호출 방지)
    if (parkingCache[place.id]) return

    setParkingLoadingId(place.id)
    setParkingErrors((prev) => {
      const next = { ...prev }
      delete next[place.id]
      return next
    })

    try {
      const lots = await getNearbyParkingLots(place.latitude, place.longitude)
      setParkingCache((prev) => ({ ...prev, [place.id]: lots }))
    } catch (err) {
      console.error('근처 주차장 조회 오류:', err)
      setParkingErrors((prev) => ({
        ...prev,
        [place.id]: '주차장 정보를 가져오지 못했어요.',
      }))
    } finally {
      setParkingLoadingId(null)
    }
  }

  const handleToggleCharger = async (place: CheckinPlace) => {
    if (expandedChargerId === place.id) {
      setExpandedChargerId(null)
      return
    }

    setExpandedChargerId(place.id)

    if (chargerCache[place.id]) return

    setChargerLoadingId(place.id)
    setChargerErrors((prev) => {
      const next = { ...prev }
      delete next[place.id]
      return next
    })

    try {
      const chargers = await getNearbyChargers(place.latitude, place.longitude)
      setChargerCache((prev) => ({ ...prev, [place.id]: chargers }))
    } catch (err) {
      console.error('근처 충전소 조회 오류:', err)
      setChargerErrors((prev) => ({
        ...prev,
        [place.id]: '충전소 정보를 가져오지 못했어요.',
      }))
    } finally {
      setChargerLoadingId(null)
    }
  }

  const handleCopyAddress = async (key: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedKey(key)
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev))
      }, 1500)
    } catch (err) {
      console.error('주소 복사 오류:', err)
    }
  }

  return (
    <>
      {errorMessage && (
        <p className="mb-3 rounded-xl bg-coral/10 p-3 text-xs text-coral">{errorMessage}</p>
      )}
      <ul className="space-y-3">
      {placesWithDistance.map((place) => {
        const inRange = place.distance <= CHECKIN_RADIUS_METERS
        const isConfirmed = confirmedIds.has(place.id)

        return (
          <li
          key={place.id}
          className="rounded-2xl border border-ink/15 bg-white p-4"
        >
          <div className="flex items-center justify-between">
          <div>
                <p className="text-sm font-semibold text-ink">{place.name}</p>
                <p className="mt-0.5 text-xs text-ink/50">
                  {inRange
                    ? `${Math.round(place.distance)}m · 체크인 가능`
                    : `${Math.round(place.distance)}m 더 가까이 가주세요`}
                </p>
                {place.address && (
                  <button
                    type="button"
                    onClick={() => handleCopyAddress(`place:${place.id}`, place.address!)}
                    className={`mt-1 flex max-w-[200px] items-center gap-1 text-left text-[11px] transition-colors ${
                      copiedKey === `place:${place.id}` ? 'text-seafoam' : 'text-ink/40'
                    }`}
                  >
                    <span className="truncate underline decoration-dotted underline-offset-2">
                      {place.address}
                    </span>
                    <Copy size={11} strokeWidth={1.8} className="shrink-0" />
                  </button>
                )}
              </div>

            <button
              type="button"
              disabled={!inRange || isConfirmed || confirmingId === place.id}
              onClick={() => handleConfirm(place.id)}
              className={
                isConfirmed
                  ? 'rounded-full bg-seafoam/20 px-4 py-2 text-xs font-semibold text-seafoam'
                  : inRange
                  ? 'rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white disabled:opacity-60'
                  : 'cursor-not-allowed rounded-full bg-ink/10 px-4 py-2 text-xs font-semibold text-ink/30'
              }
            >
              {isConfirmed ? '✅ 확인됨' : confirmingId === place.id ? '확인 중...' : '방문 확인'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleToggleParking(place)}
            className="mt-3 text-xs font-medium text-ink/50 underline underline-offset-2"
          >
            {expandedParkingId === place.id ? '🅿️ 근처 주차장 접기' : '🅿️ 근처 주차장 보기'}
          </button>

          {expandedParkingId === place.id && (
            <div className="mt-2 space-y-2 border-t border-ink/10 pt-3">
              {parkingLoadingId === place.id && (
                <p className="text-xs text-ink/40">주차장 정보를 불러오는 중...</p>
              )}

              {parkingErrors[place.id] && (
                <p className="text-xs text-coral">{parkingErrors[place.id]}</p>
              )}

              {parkingLoadingId !== place.id &&
                !parkingErrors[place.id] &&
                parkingCache[place.id]?.length === 0 && (
                  <p className="text-xs text-ink/40">반경 500m 이내 주차장이 없어요.</p>
                )}

{parkingCache[place.id]?.map((lot) => (
                  <div key={lot.prkId} className="rounded-xl bg-sand/60 p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-ink">{lot.name}</p>
                      <p className="text-[10px] text-ink/40">{lot.distanceMeters}m</p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink/50">
                      {lot.totalLots != null && lot.availLots != null
                        ? `잔여 ${lot.availLots} / ${lot.totalLots}면`
                        : '실시간 정보 없음'}
                    </p>
                    {lot.address && (
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(`lot:${lot.prkId}`, lot.address!)}
                        className={`mt-1 flex max-w-full items-center gap-1 text-left text-[10px] transition-colors ${
                          copiedKey === `lot:${lot.prkId}` ? 'text-seafoam' : 'text-ink/40'
                        }`}
                      >
                        <span className="truncate underline decoration-dotted underline-offset-2">
                          {lot.address}
                        </span>
                        <Copy size={10} strokeWidth={1.8} className="shrink-0" />
                      </button>
                    )}
                  </div>
                ))}
                </div>
              )}
    
              <button
                type="button"
                onClick={() => handleToggleCharger(place)}
                className="mt-2 text-xs font-medium text-ink/50 underline underline-offset-2"
              >
                {expandedChargerId === place.id ? '⚡ 근처 충전소 접기' : '⚡ 근처 충전소 보기'}
              </button>
    
              {expandedChargerId === place.id && (
                <div className="mt-2 space-y-2 border-t border-ink/10 pt-3">
                  {chargerLoadingId === place.id && (
                    <p className="text-xs text-ink/40">충전소 정보를 불러오는 중...</p>
                  )}
    
                  {chargerErrors[place.id] && (
                    <p className="text-xs text-coral">{chargerErrors[place.id]}</p>
                  )}
    
                  {chargerLoadingId !== place.id &&
                    !chargerErrors[place.id] &&
                    chargerCache[place.id]?.length === 0 && (
                      <p className="text-xs text-ink/40">반경 500m 이내 충전소가 없어요.</p>
                    )}
    
                  {chargerCache[place.id]?.map((charger) => (
                    <div
                      key={`${charger.statId}_${charger.chgerId}`}
                      className="rounded-xl bg-sand/60 p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink">{charger.name}</p>
                        <p className="text-[10px] text-ink/40">{charger.distanceMeters}m</p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            charger.stat === '2'
                              ? 'bg-seafoam'
                              : charger.stat === '3'
                              ? 'bg-coral'
                              : charger.stat === '4'
                              ? 'bg-ink/30'
                              : 'bg-ink/15'
                          }`}
                        />
                        <p className="text-[11px] text-ink/50">
                          {charger.statLabel}
                          {charger.output ? ` · ${charger.output}kW` : ''}
                        </p>
                      </div>
                      {charger.address && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyAddress(
                              `charger:${charger.statId}_${charger.chgerId}`,
                              charger.address!
                            )
                          }
                          className={`mt-1 flex max-w-full items-center gap-1 text-left text-[10px] transition-colors ${
                            copiedKey === `charger:${charger.statId}_${charger.chgerId}`
                              ? 'text-seafoam'
                              : 'text-ink/40'
                          }`}
                        >
                          <span className="truncate underline decoration-dotted underline-offset-2">
                            {charger.address}
                          </span>
                          <Copy size={10} strokeWidth={1.8} className="shrink-0" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
            )
          })}
      </ul>
    </>
  )
}