"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import {
    getNearbyChargers,
    getChargersByLocation,
    type NearbyChargerStation,
    type ChargerUnit,
  } from "@/lib/evCharger";

  type LocationState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string }
  | { status: "ready"; latitude: number; longitude: number };

// 강원 외 지역 실시간 조회는 API 응답이 50~60초대로 오래 걸릴 수 있어
// (2026-07-05 확인), 정적 문구 대신 순환 메시지로 진행 중임을 계속 알린다.
const WIDE_LOADING_MESSAGES = [
  "주변 지역 충전소를 찾는 중...",
  "실시간 정보를 확인하고 있어요...",
  "조금만 더 기다려주세요...",
  "거의 다 왔어요...",
];

// 같은 충전소 안에서 상태가 동일한 충전기 유닛을 하나로 묶어 개수만 표시한다.
// (2026-07-04: KEPCO API 전환으로 output(kW) 정보가 없어져 상태 기준으로만 그룹핑)
function summarizeChargerUnits(units: ChargerUnit[]) {
    const map = new Map<string, { statLabel: string; stat: string | null; count: number }>();

  for (const unit of units) {
    const key = unit.statLabel;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        statLabel: unit.statLabel,
        stat: unit.stat,
        count: 1,
      });
    }
  }

  return Array.from(map.values());
}

export default function NearbyChargersSection() {
  const [location, setLocation] = useState<LocationState>({ status: "loading" });
  const [chargers, setChargers] = useState<NearbyChargerStation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState(500);
  // 강원(강릉) DB 기준 1km 이내에도 없을 때, 실제 위치의 지역(강원 외 포함)으로
  // 넓게 재조회한 결과 (Kakao 좌표→행정구역 변환 + zcode 기반 실시간 API)
  const [wideChargers, setWideChargers] = useState<NearbyChargerStation[] | null>(null);
  const [wideLoading, setWideLoading] = useState(false);
  // 주소 복사 버튼 클릭 시 잠깐 "복사됨" 표시를 위한 state (2026-07-05 추가)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyAddress = (statId: string, address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedId(statId);
      setTimeout(() => {
        setCopiedId((prev) => (prev === statId ? null : prev));
      }, 1500);
    });
  };
  const [wideLoadingMsgIndex, setWideLoadingMsgIndex] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({
        status: "error",
        message: "이 기기에서는 위치 기능을 사용할 수 없어요.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          status: "ready",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocation({ status: "denied" });
        } else {
          setLocation({ status: "error", message: "위치를 가져오지 못했어요." });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (location.status !== "ready") return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getNearbyChargers(location.latitude, location.longitude, radius)
      .then((result) => {
        if (cancelled) return;
        setChargers(result);

        // 1km 반경까지 넓혀도 결과가 0건이면, 강릉 DB가 아니라
        // 실제 위치의 지역(zcode)에 맞는 실시간 API로 재조회한다.
        if (result.length === 0 && radius >= 1000) {
            setWideLoading(true);
            setWideLoadingMsgIndex(0);
            getChargersByLocation(location.latitude, location.longitude)
            .then(({ chargers: wide }) => {
              if (!cancelled) setWideChargers(wide);
            })
            .catch((err) => {
              console.error("위치 기반 충전소 조회 오류:", err);
              if (!cancelled) setWideChargers([]);
            })
            .finally(() => {
              if (!cancelled) setWideLoading(false);
            });
        } else {
          setWideChargers(null);
        }
      })
      .catch((err) => {
        console.error("근처 충전소 조회 오류:", err);
        if (!cancelled) setError("충전소 정보를 가져오지 못했어요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

      return () => {
        cancelled = true;
      };
    }, [location, radius]);
  
    // wideLoading이 true인 동안 4초마다 메시지를 순환시킨다.
    // 데이터 fetch 로직과는 완전히 분리된 표시 전용 effect.
    useEffect(() => {
      if (!wideLoading) return;
  
      const interval = setInterval(() => {
        setWideLoadingMsgIndex((prev) => (prev + 1) % WIDE_LOADING_MESSAGES.length);
      }, 4000);
  
      return () => clearInterval(interval);
    }, [wideLoading]);
  
    if (location.status === "loading") {
    return <p className="text-sm text-ink/40">📍 위치를 확인하는 중이에요...</p>;
  }

  if (location.status === "denied") {
    return (
      <p className="text-sm text-ink/40">
        위치 권한을 허용하면 내 주변 충전소를 보여드릴 수 있어요.
      </p>
    );
  }

  if (location.status === "error") {
    return <p className="text-sm text-ink/40">{location.message}</p>;
  }

  if (loading) {
    return <p className="text-sm text-ink/40">충전소 정보를 불러오는 중...</p>;
  }

  if (error) {
    return <p className="text-sm text-coral">{error}</p>;
  }

  if (!chargers || chargers.length === 0) {
    if (radius < 1000) {
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-ink/40">반경 500m 이내 충전소가 없어요.</p>
          <button
            type="button"
            onClick={() => setRadius(1000)}
            className="text-sm font-medium text-seafoam underline underline-offset-2"
          >
            ⚡ 1km로 넓혀서 보기
          </button>
        </div>
      );
    }
    if (wideLoading) {
        return (
          <p className="text-sm text-ink/40 transition-opacity duration-300">
            {WIDE_LOADING_MESSAGES[wideLoadingMsgIndex]}
          </p>
        );
      }
  
      if (wideChargers && wideChargers.length > 0) {
        return (
          <div className="space-y-2">
            <p className="text-xs text-ink/40">
              1km 이내에는 충전소가 없어 현재 위치 기준으로 가까운 충전소를 보여드려요.
            </p>
            {wideChargers.map((station) => (
              <div
                key={station.statId}
                className="rounded-2xl border border-ink/10 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{station.name}</p>
                  <p className="text-xs text-ink/40">
                    {station.distanceMeters >= 1000
                      ? `${(station.distanceMeters / 1000).toFixed(1)}km`
                      : `${station.distanceMeters}m`}
                  </p>
                </div>
                {station.address && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <p className="flex-1 text-xs text-ink/40">{station.address}</p>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyAddress(station.statId, station.address as string)
                      }
                      className="shrink-0 text-ink/30 transition-colors hover:text-seafoam"
                      aria-label="주소 복사"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {copiedId === station.statId && (
                      <span className="shrink-0 text-[10px] text-seafoam">복사됨</span>
                    )}
                  </div>
                )}
                <div className="mt-1 space-y-0.5">
                  {summarizeChargerUnits(station.chargers).map((group) => (
                    <div key={group.statLabel} className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          group.stat === "1"
                            ? "bg-seafoam"
                            : group.stat === "2"
                            ? "bg-coral"
                            : group.stat === "3"
                            ? "bg-ink/30"
                            : "bg-ink/15"
                        }`}
                      />
                      <p className="text-xs text-ink/50">
                        {group.statLabel}
                        {group.count > 1 ? ` × ${group.count}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      }
  
      return (
        <p className="text-sm text-ink/40">
          😥 이 근처엔 충전소가 없네요. 이동 후 다시 확인해주세요!
        </p>
      );
  }

  return (
    <div className="space-y-2">
      {chargers.map((station) => (
        <div
          key={station.statId}
          className="rounded-2xl border border-ink/10 bg-white p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{station.name}</p>
            <p className="text-xs text-ink/40">{station.distanceMeters}m</p>
          </div>
          {station.address && (
            <div className="mt-0.5 flex items-center gap-1">
              <p className="flex-1 text-xs text-ink/40">{station.address}</p>
              <button
                type="button"
                onClick={() =>
                  handleCopyAddress(station.statId, station.address as string)
                }
                className="shrink-0 text-ink/30 transition-colors hover:text-seafoam"
                aria-label="주소 복사"
              >
                <Copy className="h-3 w-3" />
              </button>
              {copiedId === station.statId && (
                <span className="shrink-0 text-[10px] text-seafoam">복사됨</span>
              )}
            </div>
          )}
          <div className="mt-1 space-y-0.5">
          {summarizeChargerUnits(station.chargers).map((group) => (
              <div
                key={group.statLabel}
                className="flex items-center gap-1.5"
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    group.stat === "1"
                      ? "bg-seafoam"
                      : group.stat === "2"
                      ? "bg-coral"
                      : group.stat === "3"
                      ? "bg-ink/30"
                      : "bg-ink/15"
                  }`}
                />
                <p className="text-xs text-ink/50">
                  {group.statLabel}
                  {group.count > 1 ? ` × ${group.count}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}