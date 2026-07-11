import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 인증사진 업로드(uploadCheckinPhoto)가 최대 8MB 이미지를 서버 액션으로 전송하므로
      // 기본값(1MB)보다 크게 설정. multipart 오버헤드 감안해 여유를 둠.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
