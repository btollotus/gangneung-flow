import { loginAdmin } from './actions'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink/5 px-6">
      <form
        action={loginAdmin}
        className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-bold">강릉FLOW 관리자</h1>
        <p className="mb-4 text-xs text-ink/50">비밀번호를 입력해주세요.</p>

        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          required
          autoFocus
          className="w-full rounded-xl border border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-ink/30"
        />

        {error && (
          <p className="mt-2 text-xs text-red-500">비밀번호가 올바르지 않아요.</p>
        )}

        <button
          type="submit"
          className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white"
        >
          로그인
        </button>
      </form>
    </div>
  )
}