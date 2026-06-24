import { createClient } from '@supabase/supabase-js'

// ⚠️ service_role 키 사용 — 절대 클라이언트 컴포넌트에서 import 금지
// 서버 전용 코드(Server Action, Route Handler)에서만 사용
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}