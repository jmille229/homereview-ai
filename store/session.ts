'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CategoryId, Flow, PreviewResult } from '@/lib/types'

// ─── State shape ──────────────────────────────────────────────────────────────

interface SessionState {
  // ── Intake form ──
  flow: Flow | null
  category: CategoryId | null
  description: string
  zip: string

  // ── Post-analysis ──
  sessionId: string | null
  preview: PreviewResult | null

  // ── Actions ──
  setFlow: (flow: Flow) => void
  setCategory: (category: CategoryId) => void
  setDescription: (description: string) => void
  setZip: (zip: string) => void
  setSessionId: (id: string) => void
  setPreview: (preview: PreviewResult) => void
  reset: () => void
}

const initialState = {
  flow: null,
  category: null,
  description: '',
  zip: '',
  sessionId: null,
  preview: null,
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Client-side session state.
 *
 * Persisted to sessionStorage (cleared when the tab is closed).
 * Files are NOT stored here — they are managed with local React state
 * in IntakePage to avoid storing large base64 strings.
 *
 * NOTE: Add Clerk auth here in Phase 2 to associate sessions with users.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,

      setFlow: (flow) => set({ flow }),
      setCategory: (category) => set({ category }),
      setDescription: (description) => set({ description }),
      setZip: (zip) => set({ zip }),
      setSessionId: (id) => set({ sessionId: id }),
      setPreview: (preview) => set({ preview }),

      reset: () => set(initialState),
    }),
    {
      name: 'hr-session',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : localStorage,
      ),
      // Only persist the fields needed across navigation — NOT files
      partialize: (state) => ({
        flow: state.flow,
        category: state.category,
        description: state.description,
        zip: state.zip,
        sessionId: state.sessionId,
        preview: state.preview,
      }),
    },
  ),
)
