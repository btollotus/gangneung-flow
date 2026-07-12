'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function KakaoConnect({ isLinked }: { isLinked: boolean }) {
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleKakaoLink = async () => {
    setSubmitting(true)
    setErrorMsg(null)

    const supabase = createClient()
    const { error } = await supabase.auth.linkIdentity({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/my`,
      },
    })

    if (error) {
      console.error('카카오 연결 오류:', error.message)
      setErrorMsg('카카오 연결에 실패했어요. 다시 시도해주세요.')
      setSubmitting(false)
    }
    // 성공 시 카카오 인증 페이지로 자동 이동하므로 별도 처리 불필요
  }

  if (isLinked) {
    return <p className="mt-1 text-xs text-ink/40">카카오 계정 연결됨 ✓</p>
  }

  return (
    <div className="mt-1">
      <button
        onClick={handleKakaoLink}
        disabled={submitting}
        className="text-xs text-ink/40 underline disabled:opacity-50"
      >
        {submitting ? '연결 중...' : '카카오로 계정 연결하기'}
      </button>
      {errorMsg && <p className="mt-1 text-xs text-red-500">{errorMsg}</p>}
    </div>
  )
}