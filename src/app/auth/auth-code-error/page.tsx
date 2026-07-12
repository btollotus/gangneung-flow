'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthCodeErrorContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const [submitting, setSubmitting] = useState(false)

  const isAlreadyLinked = reason === 'identity_already_exists'

  const handleKakaoLogin = async () => {
    setSubmitting(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/my`,
      },
    })

    if (error) {
      console.error('카카오 로그인 오류:', error.message)
      setSubmitting(false)
    }
    // 성공 시 카카오 인증 페이지로 자동 이동하므로 별도 처리 불필요
  }

  if (isAlreadyLinked) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-10 text-center">
        <p className="mb-2 text-4xl">🔗</p>
        <h1 className="mb-2 text-base font-bold text-ink">
          이미 연결된 카카오 계정이에요
        </h1>
        <p className="mb-6 text-sm text-ink/60">
          이 카카오 계정은 이미 다른 기기(계정)에 연결돼 있어요.
          <br />
          이 계정으로 돌아가려면 아래 버튼으로 로그인해주세요.
        </p>
        <button
          onClick={handleKakaoLogin}
          disabled={submitting}
          className="mb-3 rounded-full bg-[#FEE500] px-6 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {submitting ? '이동 중...' : '카카오로 로그인하기'}
        </button>
        <Link href="/my" className="text-xs text-ink/40 underline">
          마이페이지로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-10 text-center">
      <p className="mb-2 text-4xl">😥</p>
      <h1 className="mb-2 text-base font-bold text-ink">
        카카오 연결에 실패했어요
      </h1>
      <p className="mb-6 text-sm text-ink/60">
        잠시 후 다시 시도해주세요.
        <br />
        문제가 계속되면 앱을 새로고침한 뒤 다시 연결해보세요.
      </p>
      <Link
        href="/my"
        className="rounded-full bg-seafoam px-6 py-2.5 text-sm font-bold text-sand"
      >
        마이페이지로 돌아가기
      </Link>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthCodeErrorContent />
    </Suspense>
  )
}