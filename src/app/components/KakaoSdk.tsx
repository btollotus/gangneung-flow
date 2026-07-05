'use client'

import Script from 'next/script'

export default function KakaoSdk() {
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
        if (!key) {
          console.error('NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다')
          return
        }
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(key)
        }
      }}
    />
  )
}