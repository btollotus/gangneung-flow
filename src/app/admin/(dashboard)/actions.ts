'use server'

import { redirect } from 'next/navigation'
import { clearAdminSession } from '@/lib/adminAuth'

export async function logoutAdmin() {
  await clearAdminSession()
  redirect('/admin/login')
}