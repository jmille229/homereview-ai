'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AiQuestion, CategoryId, Flow, PreviewResult, UserAnswer } from '@/lib/types'

// ─── State shape ──────────────────────────────────────────────────────────────

interface SessionState {
  // ── Intake form ──
  flow:        Flow | null
  category:    CategoryId | null
  description: string
  zip:         string

  // ── Clarifying questions ──
  questions: AiQuestion[]
  answers:   UserAnswer[]

  // ── Post-analysis ──
  sessionId: string | null
  preview:   PreviewResult | null

  // ── Actions ──
  setFlow:        (flow: Flow) => void
  setCategory:    (category: CategoryId) => void
  setDescription: (description: string) => void
  setZip:         (zip: string) => void
  setQuestions:   (questions: AiQuestion[]) => void
  setAnswers:     (answers: UserAnswer[]) => void
  setSessionId:   (id: string) => void
  setPreview:     (preview: PreviewResult) => void
  reset:          () => void
}

const initialState = {
  flow:        null,
  category:    null,
  description: '',
  zip:         '',
  questions:   [],
  answers:     [],
  sessionId:   null,
  preview:     null,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initialState,

      setFlow:        (flow)        => set({ flow }),
      setCategory:    (category)    => set({ category }),
      setDescription: (description) => set({ description }),
      setZip:         (zip)         => set({ zip }),
      setQuestions:   (questions)   => set({ questions }),
      setAnswers:     (answers)     => set({ answers }),
      setSessionId:   (id)          => set({ sessionId: id }),
      setPreview:     (preview)     => set({ preview }),

      reset: () => set(initialState),
    }),
    {
      name: 'hr-session',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : localStorage,
      ),
      partialize: (state) => ({
        flow:        state.flow,
        category:    state.category,
        description: state.description,
        zip:         state.zip,
        questions:   state.questions,
        answers:     state.answers,
        sessionId:   state.sessionId,
        preview:     state.preview,
      }),
    },
  ),
)
