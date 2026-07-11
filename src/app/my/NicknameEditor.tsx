'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateNickname } from './actions'

export default function NicknameEditor({ currentNickname }: { currentNickname: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentNickname)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSave = async () => {
    setSubmitting(true)
    setErrorMsg(null)

    const result = await updateNickname(value)
    setSubmitting(false)

    if (!result.success) {
      setErrorMsg(result.error)
      return
    }

    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setValue(currentNickname)
          setErrorMsg(null)
          setEditing(true)
        }}
        className="text-xs text-ink/40 underline"
      >
        닉네임 수정
      </button>
    )
  }

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          disabled={submitting}
          className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSave}
          disabled={submitting}
          className="text-xs font-semibold text-blue-600 disabled:opacity-50"
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={submitting}
          className="text-xs text-ink/40 disabled:opacity-50"
        >
          취소
        </button>
      </div>
      {errorMsg && <p className="mt-1 text-xs text-red-500">{errorMsg}</p>}
    </div>
  )
}