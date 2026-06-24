import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

 // 만료된 토큰 자동 새로고침 (getSession()이 아니라 getUser() 사용 — 매번 서버에 재검증함)
 const { data: { user } } = await supabase.auth.getUser()

 // 세션이 전혀 없는 첫 방문자라면 익명 로그인 자동 발급
 if (!user) {
   const { error: signInError } = await supabase.auth.signInAnonymously()
   if (signInError) {
     console.error('익명 로그인 실패:', signInError.message)
   }
 }

  return supabaseResponse
}