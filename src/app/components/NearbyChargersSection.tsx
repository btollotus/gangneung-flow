"use client";

import { useEffect, useState } from "react";
import { getNearbyChargers, type NearbyCharger } from "@/lib/evCharger";

type LocationState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string }
  | { status: "ready"; latitude: number; longitude: number };

export default function NearbyChargersSection() {
  const [location, setLocation] = useState<LocationState>({ status: "loading" });
  const [chargers, setChargers] = useState<NearbyCharger[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    getNearbyChargers(location.latitude, location.longitude)
      .then((result) => {
        if (!cancelled) setChargers(result);
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
  }, [location]);

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
    return <p className="text-sm text-ink/40">반경 500m 이내 충전소가 없어요.</p>;
  }

  return (
    <div className="space-y-2">
      {chargers.map((charger) => (
        <div
          key={`${charger.statId}_${charger.chgerId}`}
          className="rounded-2xl border border-ink/10 bg-white p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{charger.name}</p>
            <p className="text-xs text-ink/40">{charger.distanceMeters}m</p>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                charger.stat === "2"
                  ? "bg-seafoam"
                  : charger.stat === "3"
                  ? "bg-coral"
                  : charger.stat === "4"
                  ? "bg-ink/30"
                  : "bg-ink/15"
              }`}
            />
            <p className="text-xs text-ink/50">
              {charger.statLabel}
              {charger.output ? ` · ${charger.output}kW` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}