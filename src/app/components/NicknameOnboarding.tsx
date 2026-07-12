'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateFallbackNickname } from '@/lib/fallbackNickname'

export default function NicknameOnboarding() {
  const [loading, setLoading] = useState(true)
  const [needsNickname, setNeedsNickname] = useState(false)
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const checkProfile = async () => {
      if (
        typeof window !== 'undefined' &&
        sessionStorage.getItem('nickname_skip') === '1'
      ) {
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        setLoading(false)
        return
      }

      // 본인 row만 조회됨 (RLS: auth.uid() = user_id)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userData.user.id)
        .maybeSingle()

      if (profileError) {
        console.error('profiles 조회 오류:', profileError.message)
        setLoading(false)
        return
      }

      if (!profile) {
        setNeedsNickname(true)
      }
      setLoading(false)
    }

    checkProfile()
  }, [])

  const handleSubmit = async () => {
    const trimmed = nickname.trim()
    if (!trimmed) {
      setErrorMsg('닉네임을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    const supabase = createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setErrorMsg('로그인이 필요해요. 새로고침 후 다시 시도해주세요.')
      setSubmitting(false)
      return
    }

    // created_at은 입력하지 않음 — DB DEFAULT now()로 자동 기록
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ user_id: userData.user.id, nickname: trimmed })

    if (insertError) {
      if (insertError.code === '23505') {
        setErrorMsg('이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.')
      } else {
        console.error('profiles insert 오류:', insertError.message)
        setErrorMsg('저장에 실패했어요. 다시 시도해주세요.')
      }
      setSubmitting(false)
      return
    }

    setNeedsNickname(false)
    setSubmitting(false)
  }

  const handleSkip = async () => {
    setSubmitting(true)

    const supabase = createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (!userError && userData.user) {
      const fallbackNickname = generateFallbackNickname(userData.user.id)
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ user_id: userData.user.id, nickname: fallbackNickname })

      // 23505(닉네임 중복)는 드문 충돌이므로 무시 — 이 경우 기존과 동일하게 profile 없이 진행됨
      if (insertError && insertError.code !== '23505') {
        console.error('스킵 시 기본 프로필 생성 오류:', insertError.message)
      }
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('nickname_skip', '1')
    }
    setSubmitting(false)
    setNeedsNickname(false)
  }

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

  // 재방문 사용자용 — 이미 카카오로 연결된 계정을 이 기기에서 불러올 때 사용.
  // linkIdentity와 달리 signInWithOAuth는 이 기기의 새 익명 세션을 버리고
  // 기존에 카카오와 연결된 영구 계정으로 전환한다.
  const handleKakaoLogin = async () => {
    setSubmitting(true)
    setErrorMsg(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/my`,
      },
    })

    if (error) {
      console.error('카카오 로그인 오류:', error.message)
      setErrorMsg('카카오 로그인에 실패했어요. 다시 시도해주세요.')
      setSubmitting(false)
    }
    // 성공 시 카카오 인증 페이지로 자동 이동하므로 별도 처리 불필요
  }

  if (loading || !needsNickname) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">닉네임을 정해주세요</h2>
        <p className="mt-1 text-sm text-gray-500">
          주간 랭킹에 표시될 닉네임이에요. 언제든 변경할 수 있어요.
        </p>

        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="닉네임 입력"
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        {errorMsg && <p className="mt-2 text-sm text-red-500">{errorMsg}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? '저장 중...' : '시작하기'}
        </button>

        <div className="mt-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">또는</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          onClick={handleKakaoLink}
          disabled={submitting}
          className="mt-3 w-full rounded-lg bg-[#FEE500] py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          카카오로 계정 연결하기
        </button>
        <p className="mt-1.5 text-center text-[11px] text-gray-400">
          연결하면 기기를 바꿔도 데이터가 유지돼요
        </p>

        <button
          onClick={handleSkip}
          disabled={submitting}
          className="mt-2 w-full text-center text-xs text-gray-400 underline disabled:opacity-50"
        >
          나중에 할게요
        </button>

        <button
          onClick={handleKakaoLogin}
          disabled={submitting}
          className="mt-3 w-full text-center text-xs text-gray-400 underline disabled:opacity-50"
        >
          이미 카카오 계정이 있으신가요? 로그인하기
        </button>
      </div>
    </div>
  )
}