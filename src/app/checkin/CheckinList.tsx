'use client'

import { useEffect, useState } from 'react'
import type { CheckinPlace } from './page'
import { confirmVisit } from './actions'

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

export default function CheckinList({ places }const [location, setLocation] = useState<LocationState>({ status: 'loading' })
const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
const [confirmingId, setConfirmingId] = useState<string | null>(null)
const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
            className="flex items-center justify-between rounded-2xl border border-ink/15 bg-white p-4"
          >
            <div>
              <p className="text-sm font-semibold text-ink">{place.name}</p>
              <p className="mt-0.5 text-xs text-ink/50">
                {inRange
                  ? `${Math.round(place.distance)}m · 체크인 가능`
                  : `${Math.round(place.distance)}m 더 가까이 가주세요`}
              </p>
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
          </li>
        )
      })}
      </ul>
    </>
  )
}