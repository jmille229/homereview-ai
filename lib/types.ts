/**
 * lib/types.ts — Application type definitions.
 *
 * Import hierarchy (no cycles):
 *   enums.ts      → (nothing)
 *   validators.ts → enums.ts
 *   types.ts      → enums.ts + validators.ts
 *   everything    → types.ts
 *
 * AI-output report types (DiagnosticBriefReport, QuoteShieldReport,
 * PreviewResult) are derived from Zod schemas via z.infer so that
 * validators.ts is the single source of truth for their shape.
 * Adding or removing a field in the schema automatically updates the type —
 * no manual synchronisation required.
 *
 * Non-AI-output types (StoredSession, ChatMessage, ReportUpdate, etc.) are
 * defined as interfaces here because they are produced by the application,
 * not validated from AI output.
 */

import type { z } from 'zod'
import type {
  diagnosticBriefSchema,
  previewResultSchema,
  quoteShieldSchema,
} from './validators'

// ─── Re-export all enums for backward compatibility ───────────────────────────
//
// All other files in the codebase import from '@/lib/types'. Re-exporting
// ensures no import paths need to change — the refactor is fully internal.

export type {
  AllowedMimeType,
  CategoryId,
  DiagnosisVerdict,
  DiyFeasibility,
  Flow,
  PricingVerdict,
  Product,
  ReportStatus,
  ScopeVerdict,
  Severity,
  UpdateType,
} from './enums'

// ─── File upload ──────────────────────────────────────────────────────────────

export interface UploadedFile {
  name: string
  type: import('./enums').AllowedMimeType
  size: number   // bytes
  data: string   // base64 encoded (no data URL prefix)
}

// ─── Clarifying questions (Step 2 of the intake flow) ────────────────────────

export interface AiQuestion {
  id: string       // stable identifier for pairing with answers
  question: string
}

export interface UserAnswer {
  questionId: string
  question: string  // stored alongside for prompt context
  answer: string
}

// ─── Conversational features ──────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface FollowupMessage {
  question: string
  answer: string
  timestamp: string
}

// ─── AI-output derived types (single source of truth: validators.ts) ─────────
//
// These use z.infer so the schema IS the type definition. The Zod schema
// in validators.ts governs both runtime validation and the static type.

/** Free preview shown before purchase. Derived from previewResultSchema. */
export type PreviewResult = z.infer<typeof previewResultSchema>

/** Full pre-quote report. Derived from diagnosticBriefSchema. */
export type DiagnosticBriefReport = z.infer<typeof diagnosticBriefSchema>

/**
 * Full post-quote report. Derived from quoteShieldSchema plus the `updates`
 * field, which is application-managed (not AI-output) and therefore not in
 * the Zod schema.
 */
export type QuoteShieldReport =
  z.infer<typeof quoteShieldSchema> & { updates: ReportUpdate[] }

// ─── Application-managed types (not AI-output) ────────────────────────────────

export interface ReportUpdate {
  timestamp: string
  updateType: import('./enums').UpdateType
  changedSections: string[]
  summary: string
}

// ─── Session (stored in Redis) ────────────────────────────────────────────────

/**
 * Report generation lifecycle:
 *   undefined    → session created before payment (preview stage)
 *   'generating' → payment verified, waitUntil running generation
 *   'complete'   → report saved to Redis, ready to view
 *   'failed'     → generation failed, user should contact support
 */
export interface StoredSession {
  id: string
  flow: import('./enums').Flow
  category: import('./enums').CategoryId
  description: string
  zip: string
  answers: UserAnswer[]
  preview: PreviewResult
  paid: boolean
  paidAt?: string
  product?: import('./enums').Product
  reportStatus?: import('./enums').ReportStatus
  report?: DiagnosticBriefReport | QuoteShieldReport
  reportError?: string
  followupCount: number
  followupMessages: FollowupMessage[]
  chatMessages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface QuestionsRequest {
  flow: import('./enums').Flow
  category: import('./enums').CategoryId
  description: string
}

export interface QuestionsResponse {
  questions: AiQuestion[]
}

export interface AnalyzeRequest {
  flow: import('./enums').Flow
  category: import('./enums').CategoryId
  description: string
  zip: string
  files: UploadedFile[]
  answers: UserAnswer[]
}

export interface AnalyzeResponse {
  sessionId: string
  preview: PreviewResult
}

export interface FollowupRequest {
  sessionId: string
  question: string
}

export interface FollowupResponse {
  answer: string
  questionsRemaining: number
}

export interface ChatRequest {
  sessionId: string
  message: string
  history: ChatMessage[]
}

export interface ChatResponse {
  reply: string
}

export interface GenerateReportRequest {
  stripeSessionId: string
}

export interface GenerateReportResponse {
  status: 'generating'
  sessionId: string
  product: import('./enums').Product
}

export interface ReportStatusResponse {
  status: import('./enums').ReportStatus
  /** Populated when status === 'complete'. The path to navigate to. */
  reportPath?: string
  /** Populated when status === 'failed'. */
  error?: string
}

export interface UpdateReportRequest {
  sessionId: string
  updateType: import('./enums').UpdateType
  files: UploadedFile[]
  note?: string
}

export interface UpdateReportResponse {
  report: QuoteShieldReport
}

export interface CheckoutRequest {
  sessionId: string
  product: import('./enums').Product
}

export interface CheckoutResponse {
  url: string
}

export interface ApiError {
  error: string
}
