"use client";

import { RefreshCw } from "lucide-react";

export default function RefreshButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="flex items-center gap-1 text-xs text-ink/40 transition-colors hover:text-seafoam"
      aria-label="다시 검색"
    >
      <RefreshCw className="h-3 w-3" />
      다시 검색
    </button>
  );
}