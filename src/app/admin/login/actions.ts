'use server'

import { redirect } from 'next/navigation'
import { createAdminSession, verifyAdminPassword } from '@/lib/adminAuth'

export async function loginAdmin(formData: FormData) {
  const password = formData.get('password')

  if (typeof password !== 'string' || !password) {
    redirect('/admin/login?error=1')
  }

  let valid = false
  try {
    valid = verifyAdminPassword(password)
  } catch (e) {
    console.error('관리자 비밀번호 검증 오류:', e instanceof Error ? e.message : e)
    redirect('/admin/login?error=1')
  }

  if (!valid) {
    redirect('/admin/login?error=1')
  }

  await createAdminSession()
  redirect('/admin')
}