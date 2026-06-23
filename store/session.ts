'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AiQuestion, CategoryId, ComparisonTeaser, Flow, PreviewResult, UserAnswer } from '@/lib/types'

// ─── State shape ──────────────────────────────────────────────────────────────

interface SessionState {
  // ── Intake form ──
  flow:         Flow | null
  category:     CategoryId | null
  // Optional secondary areas the issue "also affects." The primary `category`
  // stays the report's lens; these are passed to the AI as context only.
  relatedAreas: CategoryId[]
  description:  string
  zip:          string

  // ── Clarifying questions ──
  questions: AiQuestion[]
  answers:   UserAnswer[]

  // ── Post-analysis ──
  sessionId: string | null
  preview:   PreviewResult | null
  // Free 2-quote comparison teaser, when a second quote was uploaded.
  comparisonTeaser: ComparisonTeaser | null

  // Set when a re-run (after the user edits inputs) produces a different
  // severity than the prior preview — so we can explain the change to them.
  severityNotice: { from: string; to: string } | null

  // ── Actions ──
  setFlow:           (flow: Flow) => void
  setCategory:       (category: CategoryId) => void
  toggleRelatedArea: (area: CategoryId) => void
  setDescription:    (description: string) => void
  setZip:            (zip: string) => void
  setQuestions:      (questions: AiQuestion[]) => void
  setAnswers:        (answers: UserAnswer[]) => void
  setSessionId:      (id: string) => void
  setPreview:        (preview: PreviewResult) => void
  setComparisonTeaser: (teaser: ComparisonTeaser | null) => void
  setSeverityNotice: (notice: { from: string; to: string } | null) => void
  reset:             () => void
}

const initialState = {
  flow:         null,
  category:     null,
  relatedAreas: [] as CategoryId[],
  description:  '',
  zip:          '',
  questions:   [],
  answers:     [],
  sessionId:   null,
  preview:     null,
  comparisonTeaser: null,
  severityNotice: null,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,

      setFlow:        (flow)        => set({ flow }),
      // Choosing a primary drops it from the related set (can't be both).
      setCategory:    (category)    =>
        set((s) => ({ category, relatedAreas: s.relatedAreas.filter((a) => a !== category) })),
      toggleRelatedArea: (area)     =>
        set((s) => ({
          relatedAreas: s.relatedAreas.includes(area)
            ? s.relatedAreas.filter((a) => a !== area)
            : [...s.relatedAreas, area],
        })),
      setDescription: (description) => set({ description }),
      setZip:         (zip)         => set({ zip }),
      setQuestions:   (questions)   => set({ questions }),
      setAnswers:     (answers)     => set({ answers }),
      setSessionId:      (id)          => set({ sessionId: id }),
      setPreview:        (preview)     => set({ preview }),
      setComparisonTeaser: (teaser)    => set({ comparisonTeaser: teaser }),
      setSeverityNotice: (notice)      => set({ severityNotice: notice }),

      reset: () => set(initialState),
    }),
    {
      name: 'hr-session',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : localStorage,
      ),
      partialize: (state) => ({
        flow:         state.flow,
        category:     state.category,
        relatedAreas: state.relatedAreas,
        description:  state.description,
        zip:          state.zip,
        questions:   state.questions,
        answers:     state.answers,
        sessionId:   state.sessionId,
        preview:     state.preview,
        comparisonTeaser: state.comparisonTeaser,
        severityNotice: state.severityNotice,
      }),
    },
  ),
)
