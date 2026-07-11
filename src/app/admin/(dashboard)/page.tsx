import { logoutAdmin } from './actions'

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">강릉FLOW 관리자</h1>
        <form action={logoutAdmin}>
          <button type="submit" className="text-xs text-ink/50 underline">
            로그아웃
          </button>
        </form>
      </div>
      <p className="mt-4 text-sm text-ink/60">
        신고·검수 대기 사진 목록은 다음 단계에서 이 페이지에 추가됩니다.
      </p>
    </div>
  )
}