"use client";

import { useEffect, useState } from "react";

const CCTV_IMG_NUMBER = "52"; // 경포해변 전용 (해양수산부 연안포털 확인됨)
const REFRESH_INTERVAL_MS = 30000; // 30초

export default function CctvViewer() {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const buildUrl = () =>
      `https://coast.mof.go.kr/serviceGateway.jsp?http://10.176.62.134:9001/tilemapApi.do?url=http://220.95.232.18:8080/img/${CCTV_IMG_NUMBER}_0.jpg?${Date.now()}`;

    setSrc(buildUrl());
    const interval = setInterval(() => {
      setFailed(false);
      setSrc(buildUrl());
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  if (failed || !src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-ink/5 text-sm text-ink/40">
        실시간 영상을 불러올 수 없습니다
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl">
      <img
        src={src}
        alt="경포해변 실시간 CCTV"
        className="aspect-video w-full object-cover"
        onError={() => setFailed(true)}
      />
      <p className="mt-1 text-[10px] text-ink/40">
        출처: 해양수산부 연안포털 · 30초마다 갱신
      </p>
    </div>
  );
}