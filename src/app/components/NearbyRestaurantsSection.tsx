"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { getNearbyRestaurants, type NearbyRestaurant } from "@/lib/restaurants";

type LocationState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string }
  | { status: "ready"; latitude: number; longitude: number };

type Tab = "restaurant" | "cafe";

export default function NearbyRestaurantsSection() {
  const [location, setLocation] = useState<LocationState>({ status: "loading" });
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("restaurant");

  const handleCopyAddress = (contentId: string, address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedId(contentId);
      setTimeout(() => {
        setCopiedId((prev) => (prev === contentId ? null : prev));
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

  // EV충전소와 동일하게 위치 확정 즉시 자동 검색하지 않고 버튼 클릭 시에만 실행한다.
  const handleSearch = () => {
    if (location.status !== "ready") return;

    setLoading(true);
    setError(null);

    getNearbyRestaurants(location.latitude, location.longitude)
      .then(({ restaurants: result, error: apiError }) => {
        if (apiError) {
          setError("맛집 정보를 가져오지 못했어요.");
          return;
        }
        setRestaurants(result);
      })
      .catch((err) => {
        console.error("근처 맛집 조회 오류:", err);
        setError("맛집 정보를 가져오지 못했어요.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const refreshControl = (
    <div className="mb-2 flex justify-end">
      <button
        type="button"
        onClick={handleSearch}
        className="flex items-center gap-1 text-xs text-ink/40 transition-colors hover:text-seafoam"
        aria-label="다시 검색"
      >
        <RefreshCw className="h-3 w-3" />
        다시 검색
      </button>
    </div>
  );

  const tabControl = (
    <div className="mb-3 flex gap-2">
      <button
        type="button"
        onClick={() => setTab("restaurant")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          tab === "restaurant"
            ? "bg-seafoam text-white"
            : "bg-seafoam/10 text-seafoam"
        }`}
      >
        음식점
      </button>
      <button
        type="button"
        onClick={() => setTab("cafe")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          tab === "cafe" ? "bg-seafoam text-white" : "bg-seafoam/10 text-seafoam"
        }`}
      >
        카페
      </button>
    </div>
  );

  if (location.status === "loading") {
    return <p className="text-sm text-ink/40">📍 위치를 확인하는 중이에요...</p>;
  }

  if (location.status === "denied") {
    return (
      <p className="text-sm text-ink/40">
        위치 권한을 허용하면 내 주변 맛집을 보여드릴 수 있어요.
      </p>
    );
  }

  if (location.status === "error") {
    return <p className="text-sm text-ink/40">{location.message}</p>;
  }

  if (loading) {
    return <p className="text-sm text-ink/40">맛집을 찾는 중이에요...</p>;
  }

  if (error) {
    return (
      <>
        {refreshControl}
        <p className="text-sm text-coral">{error}</p>
      </>
    );
  }

  if (restaurants === null) {
    return (
      <button
        type="button"
        onClick={handleSearch}
        className="w-full rounded-2xl border border-seafoam/30 bg-seafoam/10 px-4 py-3 text-sm font-medium text-seafoam transition-colors hover:bg-seafoam/20"
      >
        🍜 내 주변 맛집 검색하기
      </button>
    );
  }

  const filtered = restaurants.filter((r) =>
    tab === "cafe" ? r.isCafe : !r.isCafe
  );

  return (
    <div className="space-y-2">
      {tabControl}
      {refreshControl}
      {filtered.length === 0 ? (
        <p className="text-sm text-ink/40">
          😥 이 근처엔 {tab === "cafe" ? "카페가" : "음식점이"} 없네요. 이동 후 다시
          확인해주세요!
        </p>
      ) : (
        filtered.map((place) => (
          <div
            key={place.contentId}
            className="rounded-2xl border border-ink/10 bg-white p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{place.name}</p>
              <p className="text-xs text-ink/40">{place.distanceMeters}m</p>
            </div>
            {place.address && (
              <div className="mt-0.5 flex items-center gap-1">
                <p className="flex-1 text-xs text-ink/40">{place.address}</p>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyAddress(place.contentId, place.address as string)
                  }
                  className="shrink-0 text-ink/30 transition-colors hover:text-seafoam"
                  aria-label="주소 복사"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {copiedId === place.contentId && (
                  <span className="shrink-0 text-[10px] text-seafoam">복사됨</span>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}