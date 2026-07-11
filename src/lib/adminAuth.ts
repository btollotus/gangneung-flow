import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'gnflow_admin_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7일

function getSecret(): string {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    throw new Error('ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.')
  }
  return password
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export async function createAdminSession() {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  const payload = String(expiresAt)
  const token = `${payload}.${sign(payload)}`

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  let expectedSignature: string
  try {
    expectedSignature = sign(payload)
  } catch (e) {
    console.error('관리자 세션 검증 오류:', e instanceof Error ? e.message : e)
    return false
  }

  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (sigBuffer.length !== expectedBuffer.length) return false
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false

  const expiresAt = Number(payload)
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) return false

  return true
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export function verifyAdminPassword(input: string): boolean {
  const password = getSecret()
  const inputBuffer = Buffer.from(input)
  const passwordBuffer = Buffer.from(password)
  if (inputBuffer.length !== passwordBuffer.length) return false
  return crypto.timingSafeEqual(inputBuffer, passwordBuffer)
}