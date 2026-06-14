import type { Metadata } from 'next'
import { AdminConsole } from '@/components/admin/AdminConsole'

export const metadata: Metadata = {
  title: 'Support console',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <AdminConsole />
    </main>
  )
}
