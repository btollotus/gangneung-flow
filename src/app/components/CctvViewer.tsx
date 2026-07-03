"use client";
import { useEffect, useState } from "react";

type Beach = {
  id: string;
  label: string;
  imgNumber: string;
};

// 해양수산부 연안포털 확인된 img 번호 (12차 세션 조사 완료)
const BEACHES: Beach[] = [
  { id: "gyeongpo", label: "경포", imgNumber: "52" },
  { id: "gangmun", label: "강문", imgNumber: "51" },
  { id: "jeongdongjin", label: "정동진", imgNumber: "56" },
];

const REFRESH_INTERVAL_MS = 30000; // 30초

export default function CctvViewer() {
  const [selectedBeach, setSelectedBeach] = useState<Beach>(BEACHES[0]);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const buildUrl = () =>
      `https://coast.mof.go.kr/serviceGateway.jsp?http://10.176.62.134:9001/tilemapApi.do?url=http://220.95.232.18:8080/img/${selectedBeach.imgNumber}_0.jpg?${Date.now()}`;

    setFailed(false);
    setSrc(buildUrl());

    const interval = setInterval(() => {
      setFailed(false);
      setSrc(buildUrl());
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [selectedBeach]);

  return (
    <div>
      <div className="mb-2 flex gap-2">
        {BEACHES.map((beach) => (
          <button
            key={beach.id}
            onClick={() => setSelectedBeach(beach)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedBeach.id === beach.id
                ? "bg-ink text-white"
                : "bg-ink/5 text-ink/50"
            }`}
          >
            {beach.label}
          </button>
        ))}
      </div>

      {failed || !src ? (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-ink/5 text-sm text-ink/40">
          실시간 영상을 불러올 수 없습니다
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl">
          <img
            src={src}
            alt={`${selectedBeach.label}해변 실시간 CCTV`}
            className="aspect-video w-full object-cover"
            onError={() => setFailed(true)}
          />
          <p className="mt-1 text-[10px] text-ink/40">
            출처: 해양수산부 연안포털 · 30초마다 갱신
          </p>
        </div>
      )}
    </div>
  );
}