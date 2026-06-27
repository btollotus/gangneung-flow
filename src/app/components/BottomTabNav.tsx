'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, MapPin, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Tab = {
  label: string
  href: string
  icon: LucideIcon
  disabled?: boolean
}

const TABS: Tab[] = [
  { label: '홈', href: '/', icon: Home },
  { label: '탐색', href: '/explore', icon: Compass, disabled: true },
  { label: '체크인', href: '/checkin', icon: MapPin, disabled: true },
  { label: '마이페이지', href: '/my', icon: User, disabled: true },
]

export default function BottomTabNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#102A33]/10 bg-[#F3ECDD] pb-[env(safe-area-inset-bottom)]"
      aria-label="하단 탭 내비게이션"
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon

          if (tab.disabled) {
            return (
              <li key={tab.label} className="flex-1">
                <div
                  className="flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 text-[#102A33]/30"
                  aria-disabled="true"
                >
                  <Icon size={22} strokeWidth={1.8} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </div>
              </li>
            )
          }

          return (
            <li key={tab.label} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 ${
                  isActive ? 'text-[#E2542B]' : 'text-[#102A33]/60'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}