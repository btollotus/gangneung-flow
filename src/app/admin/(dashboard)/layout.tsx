import { redirect } from 'next/navigation'
import { verifyAdminSession } from '@/lib/adminAuth'

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isValid = await verifyAdminSession()
  if (!isValid) {
    redirect('/admin/login')
  }

  return <div className="min-h-screen bg-ink/5">{children}</div>
}