'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Navigation, MapPin } from 'lucide-react'
import type { CheckinPlace } from './page'
import { confirmVisit, uploadCheckinPhoto } from './actions'
import { getNearbyParkingLots, type NearbyParkingLot } from '@/lib/parking'
import { getNearbyChargers, type NearbyChargerStation, type ChargerUnit } from '@/lib/evCharger'
import { HOOKS } from '../components/PlaceHookCard'

type LocationState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ready'; latitude: number; longitude: number }

  const CHECKIN_RADIUS_METERS = 200

  // 근처 충전소 조회는 외부 API 응답이 느릴 수 있어(2026-07-05 확인),
  // 정적 문구 대신 순환 메시지로 진행 중임을 계속 알린다. (홈 화면과 동일 패턴)
  const CHARGER_LOADING_MESSAGES = [
    '충전소 정보를 불러오는 중...',
    '실시간 상태를 확인하고 있어요...',
    '조금만 더 기다려주세요...',
    '거의 다 왔어요...',
  ]

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

// 1000m 이상은 km로 환산(소수점 1자리), 미만은 정수 m로 표시
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`
  }
  return `${Math.round(meters)}m`
}

// 같은 충전소 안에서 상태가 동일한 충전기 유닛을 하나로 묶어 개수만 표시한다.
// (2026-07-04: KEPCO API 전환으로 output(kW) 정보가 없어져 상태 기준으로만 그룹핑)
function summarizeChargerUnits(units: ChargerUnit[]) {
  const map = new Map<string, { statLabel: string; stat: string | null; count: number }>()

  for (const unit of units) {
    const key = unit.statLabel
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
    } else {
      map.set(key, {
        statLabel: unit.statLabel,
        stat: unit.stat,
        count: 1,
      })
    }
  }

  return Array.from(map.values())
}

// 장소명으로 홈 화면과 동일한 훅 멘트를 찾는다. 일치하는 게 없으면 null (해당 장소는 훅 문구 없이 표시).
function getHookForPlace(name: string): string | null {
  return HOOKS.find((h) => h.name === name)?.hook ?? null
}

export default function CheckinList({
  places,
  visitedPlaceIds,
  photoPlaceIds,
}: {
  places: CheckinPlace[]
  visitedPlaceIds: string[]
  photoPlaceIds: string[]
}) {
  const [location, setLocation] = useState<LocationState>({ status: 'loading' })
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(() => new Set(visitedPlaceIds))
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 인증사진 등록 상태 — 이미 등록된 장소 id 집합, 방금 방문확인 완료 후 노출되는 등록 안내 배너,
  // 실제 업로드 대상 장소 id(파일 선택창과 연결), 업로드 진행 중 장소 id, 업로드 관련 에러
  const [photoRegisteredIds, setPhotoRegisteredIds] = useState<Set<string>>(
    () => new Set(photoPlaceIds)
  )
  const [uploadPromptId, setUploadPromptId] = useState<string | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 장소별 방문확인 고유 사용자 수 — SSR 시점 값(props)으로 초기화 후,
  // 본인 체크인 성공 시에만 +1 낙관적 갱신 (전체 재집계는 다음 페이지 진입 시 반영)
  const [visitorCounts, setVisitorCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(places.map((place) => [place.id, place.visitorCount]))
  )

  // 근처 주차장 — 카드별 펼침/캐시/로딩/에러 상태 (체크인 로직과 독립적으로 관리)
  const [expandedParkingId, setExpandedParkingId] = useState<string | null>(null)
  const [parkingCache, setParkingCache] = useState<Record<string, NearbyParkingLot[]>>({})
  const [parkingLoadingId, setParkingLoadingId] = useState<string | null>(null)
  const [parkingErrors, setParkingErrors] = useState<Record<string, string>>({})

  // 근처 충전소 — 카드별 펼침/캐시/로딩/에러 상태 (주차장 로직과 동일한 패턴, 완전히 독립적으로 관리)
  const [expandedChargerId, setExpandedChargerId] = useState<string | null>(null)
  const [chargerCache, setChargerCache] = useState<Record<string, NearbyChargerStation[]>>({})
  const [chargerLoadingId, setChargerLoadingId] = useState<string | null>(null)
  const [chargerErrors, setChargerErrors] = useState<Record<string, string>>({})
  const [chargerRadiusExpanded, setChargerRadiusExpanded] = useState<Set<string>>(new Set())
  const [chargerExpandLoading, setChargerExpandLoading] = useState<string | null>(null)
  // 순환 로딩 메시지 인덱스 (한 번에 카드 하나만 펼쳐지므로 단일 인덱스로 충분)
  const [chargerLoadingMsgIndex, setChargerLoadingMsgIndex] = useState(0)

    // 주소 복사 피드백 (장소/주차장/충전소 공용, key로 구분)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ status: 'error', message: '이 기기에서는 위치 기능을 사용할 수 없어요.' })
      return
    }

    const watchId = navigator.geolocation.watchPosition(
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

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // 충전소 조회(초기 또는 반경 확장)가 진행 중인 동안 4초마다 메시지를 순환시킨다.
  // 데이터 fetch 로직과는 완전히 분리된 표시 전용 effect. (홈 화면과 동일 패턴)
  useEffect(() => {
    const isChargerLoading = chargerLoadingId !== null || chargerExpandLoading !== null
    if (!isChargerLoading) {
      setChargerLoadingMsgIndex(0)
      return
    }

    const interval = setInterval(() => {
      setChargerLoadingMsgIndex((prev) => (prev + 1) % CHARGER_LOADING_MESSAGES.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [chargerLoadingId, chargerExpandLoading])

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
      setVisitorCounts((prev) => ({ ...prev, [placeId]: (prev[placeId] ?? 0) + 1 }))
      setUploadPromptId(placeId)
    } else {
      setErrorMessage(result.error)
    }
  }

  // "지금 촬영" 또는 이미 방문확인된 카드의 "인증사진 추가" 클릭 시 파일 선택창을 연다.
  const handleClickUploadNow = (placeId: string) => {
    setUploadError(null)
    setUploadTargetId(placeId)
    fileInputRef.current?.click()
  }

  const handleDismissUploadPrompt = (placeId: string) => {
    setUploadPromptId((prev) => (prev === placeId ? null : prev))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const placeId = uploadTargetId
    e.target.value = '' // 같은 파일 재선택 가능하도록 초기화

    if (!file || !placeId) return

    setUploadingId(placeId)
    setUploadError(null)

    const formData = new FormData()
    formData.append('photo', file)

    // 서버 액션 호출이 예외를 던지는 경우(네트워크 오류, 요청 크기 초과 등)에도
    // "업로드 중..." 상태가 영구히 남지 않도록 반드시 finally에서 초기화한다.
    try {
      const result = await uploadCheckinPhoto(placeId, formData)

      if (result.success) {
        setPhotoRegisteredIds((prev) => new Set(prev).add(placeId))
        setUploadPromptId((prev) => (prev === placeId ? null : prev))
      } else {
        setUploadError(result.error)
      }
    } catch (err) {
      console.error('사진 업로드 요청 실패:', err)
      setUploadError(
        '사진 업로드에 실패했어요. 사진 용량이 너무 크거나 네트워크가 불안정할 수 있어요. 다시 시도해주세요.'
      )
    } finally {
      setUploadingId(null)
      setUploadTargetId(null)
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

  const handleExpandChargerRadius = async (place: CheckinPlace) => {
    setChargerExpandLoading(place.id)

    try {
      const chargers = await getNearbyChargers(place.latitude, place.longitude, 1000)
      setChargerCache((prev) => ({ ...prev, [place.id]: chargers }))
      setChargerRadiusExpanded((prev) => new Set(prev).add(place.id))
    } catch (err) {
      console.error('충전소 반경 확장 조회 오류:', err)
      setChargerErrors((prev) => ({
        ...prev,
        [place.id]: '충전소 정보를 가져오지 못했어요.',
      }))
    } finally {
      setChargerExpandLoading(null)
    }
  }

  const handleRefreshCharger = async (place: CheckinPlace) => {
    // 캐시를 지우고 강제로 재조회 (기존 handleToggleCharger는 캐시 있으면 재호출 안 함)
    setChargerCache((prev) => {
      const next = { ...prev }
      delete next[place.id]
      return next
    })
    setChargerRadiusExpanded((prev) => {
      const next = new Set(prev)
      next.delete(place.id)
      return next
    })
    setChargerErrors((prev) => {
      const next = { ...prev }
      delete next[place.id]
      return next
    })
    setChargerLoadingId(place.id)

    try {
      const chargers = await getNearbyChargers(place.latitude, place.longitude)
      setChargerCache((prev) => ({ ...prev, [place.id]: chargers }))
    } catch (err) {
      console.error('충전소 재검색 오류:', err)
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

  // 카카오내비 실행 — Kakao JS SDK의 Navi.start() 호출 (KakaoSdk.tsx에서 이미 전역 초기화됨)
  // 주의: 카카오내비 앱 미설치 시 SDK가 자체적으로 앱스토어 설치 페이지로 이동시킴 (웹 폴백 없음, 최신 SDK 정책)
  const handleNavigate = (place: CheckinPlace) => {
    if (typeof window === 'undefined' || !window.Kakao || !window.Kakao.isInitialized()) {
      console.error('Kakao SDK가 아직 로드되지 않았습니다')
      return
    }
    window.Kakao.Navi.start({
      name: place.name,
      x: place.longitude,
      y: place.latitude,
      coordType: 'wgs84',
    })
  }

  // 티맵 실행 — 공식 SDK 없이 URL scheme(tmap://route)을 직접 호출 (비공식이지만 iOS/Android 공통 동작 확인됨)
  // 앱 미설치 시: visibilitychange로 앱 전환 여부를 감지, 전환이 없으면 1.5초 후 스토어로 자동 이동 (사용자 확정 사항)
  const handleNavigateTmap = (place: CheckinPlace) => {
    const tmapUrl = `tmap://route?goalname=${encodeURIComponent(place.name)}&goalx=${place.longitude}&goaly=${place.latitude}`
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const storeUrl = isIOS
      ? 'https://apps.apple.com/app/id431589174'
      : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku'

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(timer)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
    const timer = setTimeout(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.location.href = storeUrl
    }, 1500)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    window.location.href = tmapUrl
  }

  return (
    <>
      {errorMessage && (
        <p className="mb-3 rounded-xl bg-coral/10 p-3 text-xs text-coral">{errorMessage}</p>
      )}
      {uploadError && (
        <p className="mb-3 rounded-xl bg-coral/10 p-3 text-xs text-coral">{uploadError}</p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <ul className="space-y-3">
      {placesWithDistance.map((place) => {
        const inRange = place.distance <= CHECKIN_RADIUS_METERS
        const isConfirmed = confirmedIds.has(place.id)
        const hook = getHookForPlace(place.name)

        return (
          <motion.li
          key={place.id}
          layout
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="rounded-2xl border border-ink/15 bg-white p-4"
        >
         <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold text-ink">{place.name}</p>
          <span className="text-xl font-bold text-coral">{formatDistance(place.distance)}</span>
          </div>
                {hook && (
                  <p className="mt-0.5 text-[11px] font-medium text-seafoam">{hook}</p>
                )}
                <p className="mt-0.5 text-xs text-ink/50">
                {inRange ? '체크인 가능' : '더 가까이 가주세요'}
                </p>
                {(visitorCounts[place.id] ?? 0) > 0 && (
                  <p className="mt-0.5 text-[11px] font-medium text-ink/40">
                    🙋 {(visitorCounts[place.id] ?? 0).toLocaleString('ko-KR')}명 방문확인
                  </p>
                )}
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

              <div className="flex shrink-0 flex-col items-end gap-1.5">
              <button
                type="button"
                disabled={!inRange || isConfirmed || confirmingId === place.id}
                onClick={() => handleConfirm(place.id)}
                className={
                  isConfirmed
                    ? 'whitespace-nowrap rounded-full bg-seafoam/10 px-4 py-2 text-xs font-semibold text-seafoam/70'
                    : inRange
                    ? 'whitespace-nowrap rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white disabled:opacity-60'
                    : 'cursor-not-allowed whitespace-nowrap rounded-full bg-ink/10 px-4 py-2 text-xs font-semibold text-ink/30'
                }
              >
                {isConfirmed ? '방문완료' : confirmingId === place.id ? '확인 중...' : '방문 확인'}
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNavigate(place)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full bg-seafoam/15 px-3 py-1.5 text-[11px] font-semibold text-seafoam"
                >
                  <Navigation size={12} strokeWidth={2.2} />
                  카카오네비
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateTmap(place)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full bg-ink/10 px-3 py-1.5 text-[11px] font-semibold text-ink/60"
                >
                  <MapPin size={12} strokeWidth={2.2} />
                  티맵
                </button>
              </div>
            </div>
            </div>

            {isConfirmed && (
              <div className="mt-2">
                {uploadPromptId === place.id && !photoRegisteredIds.has(place.id) ? (
                  <div className="flex items-center justify-between rounded-xl bg-seafoam/10 px-3 py-2">
                    <p className="text-[11px] font-medium text-seafoam">
                      인증사진을 등록해보세요
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleClickUploadNow(place.id)}
                        disabled={uploadingId === place.id}
                        className="rounded-full bg-seafoam px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                      >
                        {uploadingId === place.id ? '업로드 중...' : '지금 촬영'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissUploadPrompt(place.id)}
                        className="text-[11px] font-medium text-ink/40"
                      >
                        나중에
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleClickUploadNow(place.id)}
                    disabled={uploadingId === place.id}
                    className="text-xs font-medium text-ink/50 underline underline-offset-2 disabled:opacity-50"
                  >
                    {uploadingId === place.id
                      ? '업로드 중...'
                      : photoRegisteredIds.has(place.id)
                      ? '📷 인증사진 등록됨'
                      : '📷 인증사진 추가'}
                  </button>
                )}
              </div>
            )}

<div className="mt-2 flex items-center gap-3">
            <button
                  type="button"
                  onClick={() => handleToggleCharger(place)}
                  className="text-xs font-medium text-ink/50 underline underline-offset-2"
                >
                  {expandedChargerId === place.id ? '⚡ 근처 충전소 접기' : '⚡ 근처 충전소 보기'}
                </button>
                {expandedChargerId === place.id && (
                  <button
                    type="button"
                    onClick={() => handleRefreshCharger(place)}
                    disabled={chargerLoadingId === place.id || chargerExpandLoading === place.id}
                    className="text-xs font-medium text-ink/40 underline underline-offset-2 disabled:opacity-50"
                  >
                    ↻ 다시 검색
                  </button>
                )}
              </div>
    
              {expandedChargerId === place.id && (
                <div className="mt-2 space-y-2 border-t border-ink/10 pt-3">
                 {chargerLoadingId === place.id && (
                    <p className="text-xs text-ink/40 transition-opacity duration-300">
                      {CHARGER_LOADING_MESSAGES[chargerLoadingMsgIndex]}
                    </p>
                  )}
    
                  {chargerErrors[place.id] && (
                    <p className="text-xs text-coral">{chargerErrors[place.id]}</p>
                  )}
    
    {chargerLoadingId !== place.id &&
                    !chargerErrors[place.id] &&
                    chargerCache[place.id]?.length === 0 &&
                    !chargerRadiusExpanded.has(place.id) && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-ink/40">반경 500m 이내 충전소가 없어요.</p>
                        <button
                          type="button"
                          onClick={() => handleExpandChargerRadius(place)}
                          disabled={chargerExpandLoading === place.id}
                          className="text-xs font-medium text-seafoam underline underline-offset-2 disabled:opacity-60"
                        >
                          {chargerExpandLoading === place.id
                            ? CHARGER_LOADING_MESSAGES[chargerLoadingMsgIndex]
                            : '⚡ 1km로 넓혀서 보기'}
                        </button>
                      </div>
                    )}

                  {chargerLoadingId !== place.id &&
                    !chargerErrors[place.id] &&
                    chargerCache[place.id]?.length === 0 &&
                    chargerRadiusExpanded.has(place.id) && (
                      <p className="text-xs text-ink/40">1km 이내에도 충전소가 없어요.</p>
                    )}
    
    {chargerCache[place.id]?.map((station) => (
                    <div key={station.statId} className="rounded-xl bg-sand/60 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink">{station.name}</p>
                        <p className="text-[10px] text-ink/40">{station.distanceMeters}m</p>
                      </div>
                      <div className="mt-1 space-y-0.5">
                      {summarizeChargerUnits(station.chargers).map((group) => (
                          <div
                            key={group.statLabel}
                            className="flex items-center gap-1.5"
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                group.stat === '1'
                                  ? 'bg-seafoam'
                                  : group.stat === '2'
                                  ? 'bg-coral'
                                  : group.stat === '3'
                                  ? 'bg-ink/30'
                                  : 'bg-ink/15'
                              }`}
                            />
                            <p className="text-[11px] text-ink/50">
                              {group.statLabel}
                              {group.count > 1 ? ` × ${group.count}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                      {station.address && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyAddress(`charger:${station.statId}`, station.address!)
                          }
                          className={`mt-1 flex max-w-full items-center gap-1 text-left text-[10px] transition-colors ${
                            copiedKey === `charger:${station.statId}`
                              ? 'text-seafoam'
                              : 'text-ink/40'
                          }`}
                        >
                          <span className="truncate underline decoration-dotted underline-offset-2">
                            {station.address}
                          </span>
                          <Copy size={10} strokeWidth={1.8} className="shrink-0" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </motion.li>
              )
            })}
        </ul>
    </>
  )
}