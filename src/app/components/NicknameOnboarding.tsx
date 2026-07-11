'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
      const fallbackNickname = `익명${userData.user.id.slice(-4)}`
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

        <button
          onClick={handleSkip}
          disabled={submitting}
          className="mt-2 w-full text-center text-xs text-gray-400 underline disabled:opacity-50"
        >
          나중에 할게요
        </button>
      </div>
    </div>
  )
}