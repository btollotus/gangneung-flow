import Link from 'next/link'

export default function AuthCodeErrorPage() {
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