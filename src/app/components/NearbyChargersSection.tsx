"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import {
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
  // 주소 복사 버튼 클릭 시 잠깐 "복사됨" 표시를 위한 state (2026-07-05 추가)
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  const handleCopyAddress = (statId: string, address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedId(statId);
      setTimeout(() => {
        setCopiedId((prev) => (prev === statId ? null : prev));
      }, 1500);
    });
  };

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

  // 충전소 조회는 더 이상 위치 확정 즉시 자동 실행하지 않고,
  // 사용자가 아래 "내 주변 충전소 검색하기" 버튼을 눌렀을 때만 실행한다.
  // (2026-07-05: 자동 검색 대신 사용자가 직접 검색을 트리거하도록 변경 요청)
  // 강원(강릉)이든 아니든 getChargersByLocation 내부에서 자동 분기하므로
  // (강원이면 로컬 DB, 그 외 지역이면 전국 실시간 API) 이 부분은 그대로 유지한다.
  const handleSearch = () => {
    if (location.status !== "ready") return;

    setLoading(true);
    setError(null);
    setLoadingMsgIndex(0);

    getChargersByLocation(location.latitude, location.longitude)
      .then(({ chargers: result }) => {
        setChargers(result);
      })
      .catch((err) => {
        console.error("근처 충전소 조회 오류:", err);
        setError("충전소 정보를 가져오지 못했어요.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // loading이 true인 동안 4초마다 메시지를 순환시킨다.
  // 데이터 fetch 로직과는 완전히 분리된 표시 전용 effect.
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % WIDE_LOADING_MESSAGES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [loading]);
  
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
    return (
      <p className="text-sm text-ink/40 transition-opacity duration-300">
        {WIDE_LOADING_MESSAGES[loadingMsgIndex]}
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-coral">{error}</p>;
  }

  if (chargers === null) {
    return (
      <button
        type="button"
        onClick={handleSearch}
        className="w-full rounded-2xl border border-seafoam/30 bg-seafoam/10 px-4 py-3 text-sm font-medium text-seafoam transition-colors hover:bg-seafoam/20"
      >
        ⚡ 내 주변 충전소 검색하기
      </button>
    );
  }

  if (chargers.length === 0) {
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