'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const isDashboard = path === '/admin/dashboard'

  return (
    <div>
      {!isDashboard && (
        <div className="px-4 sm:px-8 pt-5 pb-0">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-xs font-sans text-text-muted hover:text-text-primary transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      )}
      {children}
    </div>
  )
}
