'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import type { CategoryId } from '@/lib/types'

const CATEGORIES: Array<{ id: CategoryId; label: string; sub: string }> = [
  { id: 'hvac',        label: 'HVAC',                  sub: 'Heating, cooling & air quality' },
  { id: 'plumbing',   label: 'Plumbing',               sub: 'Pipes, drains & water heater' },
  { id: 'electrical', label: 'Electrical',             sub: 'Panels, outlets & wiring' },
  { id: 'roofing',    label: 'Roofing & Exterior',     sub: 'Roof, gutters & siding' },
  { id: 'foundation', label: 'Foundation & Structure', sub: 'Basement & crawlspace' },
  { id: 'appliances', label: 'Appliances',             sub: 'Fridge, washer, oven & more' },
  { id: 'pest',       label: 'Pest & Mold',            sub: 'Termites, rodents & moisture' },
  { id: 'maintenance',label: 'General Maintenance',    sub: 'Minor repairs & seasonal prep' },
]

export default function CategoryPage() {
  const router = useRouter()
  const { flow, setCategory } = useSessionStore()

  // Guard: redirect if no flow selected
  useEffect(() => {
    if (!flow) router.replace('/')
  }, [flow, router])

  const handleSelect = (id: CategoryId) => {
    setCategory(id)
    router.push('/intake')
  }

  if (!flow) return null

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar step="Step 1 of 3" onBack={() => router.push('/')} />

        <h2 className="text-2xl font-semibold text-brand-navy mb-2">
          What area is the issue in?
        </h2>
        <p className="text-sm text-brand-muted mb-6">
          Select the home system or area that&apos;s affected.
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
              className="card text-left hover:border-brand-border-dark active:scale-[0.99] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-amber"
            >
              <p className="text-sm font-semibold text-brand-navy mb-0.5">
                {cat.label}
              </p>
              <p className="text-xs text-brand-muted">{cat.sub}</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
