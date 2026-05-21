'use client'

import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { CategoryId } from '@/lib/types'

const CATEGORIES: Array<{ id: CategoryId; label: string; sub: string; icon: string }> = [
  { id: 'hvac',        label: 'HVAC',                  sub: 'Heating, cooling & air quality', icon: '🌡️' },
  { id: 'plumbing',    label: 'Plumbing',               sub: 'Pipes, drains & water heater',   icon: '🚿' },
  { id: 'electrical',  label: 'Electrical',             sub: 'Panels, outlets & wiring',       icon: '⚡' },
  { id: 'roofing',     label: 'Roofing & Exterior',     sub: 'Roof, gutters & siding',         icon: '🏠' },
  { id: 'foundation',  label: 'Foundation & Structure', sub: 'Basement & crawlspace',          icon: '🏗️' },
  { id: 'appliances',  label: 'Appliances',             sub: 'Fridge, washer, oven & more',    icon: '🔧' },
  { id: 'pest',        label: 'Pest & Mold',            sub: 'Termites, rodents & moisture',   icon: '🪲' },
  { id: 'maintenance', label: 'General Maintenance',    sub: 'Minor repairs & seasonal prep',  icon: '🛠️' },
]

export default function CategoryPage() {
  const router = useRouter()
  const { setCategory } = useSessionStore()

  const handleSelect = (id: CategoryId) => {
    setCategory(id)
    router.push('/intake')
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar step="Step 1 of 4" onBack={() => router.push('/')} />
        <ProgressBar step={1} total={4} />

        <h2 className="text-2xl font-semibold text-brand-navy mb-1.5">
          What area of your home?
        </h2>
        <p className="text-sm text-brand-muted mb-7">
          Select the system or area that&apos;s affected.
        </p>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
          role="list"
          aria-label="Issue categories"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              role="listitem"
              className="card text-left flex items-center gap-4 hover:border-brand-border-dark active:scale-[0.99] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-amber"
            >
              <span className="text-2xl flex-shrink-0" aria-hidden="true">{cat.icon}</span>
              <div>
                <p className="text-sm font-semibold text-brand-navy">{cat.label}</p>
                <p className="text-xs text-brand-muted mt-0.5">{cat.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
