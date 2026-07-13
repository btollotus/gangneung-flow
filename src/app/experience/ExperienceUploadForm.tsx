'use client'

import { useRef, useState } from 'react'
import { uploadExperiencePost, findNearbyDesignatedPlace, type NearbyPlace } from './actions'
import { searchKakaoPlace, type PlaceCandidate } from '@/lib/kakaoPlaceSearch'

type LocationStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

export default function ExperienceUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [linkedPlaceId, setLinkedPlaceId] = useState<string | null>(null)

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [nearbyPlace, setNearbyPlace] = useState<NearbyPlace | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PlaceCandidate[]>([])
  const [searching, setSearching] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleFindNearby = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const nearby = await findNearbyDesignatedPlace(lat, lng)
        if (nearby) {
          setNearbyPlace(nearby)
          setLocationStatus('found')
        } else {
          setLatitude(lat)
          setLongitude(lng)
          setLocationStatus('not_found')
        }
      },
      () => setLocationStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleConfirmNearby = () => {
    if (!nearbyPlace) return
    setPlaceName(nearbyPlace.name)
    setLinkedPlaceId(nearbyPlace.id)
  }

  const handleDismissNearby = () => {
    setNearbyPlace(null)
    setLocationStatus('not_found')
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await searchKakaoPlace(query)
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectCandidate = (candidate: PlaceCandidate) => {
    setPlaceName(candidate.name)
    setAddress(candidate.address)
    setLatitude(candidate.latitude)
    setLongitude(candidate.longitude)
    setLinkedPlaceId(null)
    setSearchResults([])
    setSearchQuery('')
  }

  const handleSubmit = async () => {
    setError(null)
    setNotice(null)
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('사진을 선택해주세요.')
      return
    }
    if (!placeName.trim()) {
      setError('업체명(또는 장소명)을 입력해주세요.')
      return
    }

    setSubmitting(true)
    const formData = new FormData()
    formData.append('photo', file)

    try {
      const result = await uploadExperiencePost(
        { caption, placeName, address, latitude, longitude, linkedPlaceId },
        formData
      )

      if (result.success) {
        if (result.xpEarned === 0) {
          setNotice(
            '게시물은 등록됐어요! 다만 오늘 XP 획득 한도(5건)를 채워서 이번 건은 XP 없이 등록됐어요.'
          )
        }
        setPreviewUrl(null)
        setCaption('')
        setPlaceName('')
        setAddress('')
        setLatitude(null)
        setLongitude(null)
        setLinkedPlaceId(null)
        setNearbyPlace(null)
        setLocationStatus('idle')
        if (fileInputRef.current) fileInputRef.current.value = ''
        onUploaded()
      } else {
        setError(result.error)
      }
    } catch (err) {
      console.error('경험 게시물 업로드 요청 실패:', err)
      setError('업로드에 실패했어요. 네트워크가 불안정할 수 있어요. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold">맛집·카페 경험 공유하기</p>
      <p className="mt-0.5 text-xs text-ink/50">사진 한 장 올리면 10XP! (하루 최대 5건)</p>

      <div className="mt-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="선택한 사진" className="h-40 w-full rounded-xl object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-ink/20 text-sm text-ink/40"
          >
            📷 사진 선택
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        {previewUrl && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 text-xs text-ink/40 underline"
          >
            사진 바꾸기
          </button>
        )}
      </div>

      <div className="mt-3">
        {locationStatus === 'idle' && (
          <button
            type="button"
            onClick={handleFindNearby}
            className="text-xs font-medium text-seafoam underline"
          >
            📍 현재 위치로 장소 찾기
          </button>
        )}
        {locationStatus === 'loading' && (
          <p className="text-xs text-ink/40">위치 확인 중...</p>
        )}
        {locationStatus === 'found' && nearbyPlace && linkedPlaceId !== nearbyPlace.id && (
          <div className="flex items-center justify-between rounded-xl bg-seafoam/10 px-3 py-2">
            <p className="text-[11px] font-medium text-seafoam">
              여기서 찍으셨나요? {nearbyPlace.name}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmNearby}
                className="rounded-full bg-seafoam px-3 py-1 text-[11px] font-semibold text-white"
              >
                맞아요
              </button>
              <button
                type="button"
                onClick={handleDismissNearby}
                className="text-[11px] font-medium text-ink/40"
              >
                아니에요
              </button>
            </div>
          </div>
        )}
        {locationStatus === 'error' && (
          <p className="text-xs text-red-500">위치를 가져오지 못했어요. 직접 검색해주세요.</p>
        )}
      </div>

      {locationStatus !== 'found' || linkedPlaceId === null ? (
        <div className="mt-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="업체명으로 검색 (예: OO커피)"
            className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm"
          />
          {searching && <p className="mt-1 text-xs text-ink/40">검색 중...</p>}
          {searchResults.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 rounded-xl border border-ink/10 bg-white p-1 shadow-sm">
              {searchResults.map((candidate, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectCandidate(candidate)}
                  className="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-ink/5"
                >
                  <p className="font-medium">{candidate.name}</p>
                  <p className="text-ink/40">{candidate.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-3">
        <input
          type="text"
          value={placeName}
          onChange={(e) => {
            setPlaceName(e.target.value)
            setLinkedPlaceId(null)
          }}
          placeholder="업체명(직접 입력도 가능해요)"
          className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm"
        />
        {address && <p className="mt-1 text-xs text-ink/40">{address}</p>}
      </div>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="어떤 경험이었는지 짧게 적어주세요 (선택)"
        rows={2}
        className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2 text-sm"
      />

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {notice && <p className="mt-2 text-xs text-coral">{notice}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? '업로드 중...' : '공유하기'}
      </button>
    </div>
  )
}
