// ─── Domain types ─────────────────────────────────────────────────────────────

export type Flow = 'pre' | 'post'

export type CategoryId =
  | 'hvac'
  | 'plumbing'
  | 'electrical'
  | 'roofing'
  | 'foundation'
  | 'appliances'
  | 'pest'
  | 'maintenance'

export type Severity = 'Minor' | 'Moderate' | 'Serious' | 'Urgent'
export type DiyFeasibility = 'None' | 'Low' | 'Medium' | 'High'
export type ScopeVerdict = 'Matches Problem' | 'Partial Match' | 'Scope Mismatch'
export type PricingVerdict = 'Fair' | 'High End' | 'Inflated'
export type Product = 'brief' | 'shield' | 'bundle'

// ─── File upload ──────────────────────────────────────────────────────────────

export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf'

export interface UploadedFile {
  name: string
  type: AllowedMimeType
  size: number   // bytes
  data: string   // base64 encoded (no data URL prefix)
}

// ─── AI response shapes ───────────────────────────────────────────────────────

export interface PreviewResult {
  summary: string
  severity: Severity
  severityReason: string
  costMin: number
  costMax: number
  keyInsight: string
}

export interface DiagnosticBriefReport {
  diagnosis: string
  urgencyTimeline: string
  diyFeasibility: DiyFeasibility
  diyDetails: string
  contractorType: string
  licenseRequired: string
  verifyCredentials: string[]
  costFactors: string[]
  questionsToAsk: Array<{ question: string; whyItMatters: string }>
  redFlags: string[]
  insistOnWriting: string[]
}

export interface QuoteShieldReport {
  scopeVerdict: ScopeVerdict
  scopeAnalysis: string
  pricingVerdict: PricingVerdict
  pricingAnalysis: string
  estimatedFairMin: number
  estimatedFairMax: number
  upsells: Array<{ item: string; amount: number; reason: string }>
  missingItems: string[]
  redFlags: string[]
  greenFlags: string[]
  negotiationGuide: string
  contractorQuestions: Array<{
    question: string
    goodAnswer: string
    concerningAnswer: string
  }>
  getSecondQuote: boolean
  secondQuoteReason: string
  beforeYouSign: string[]
  updates: ReportUpdate[]
}

export interface ReportUpdate {
  timestamp: string
  updateType: UpdateType
  changedSections: string[]
  summary: string
}

export type UpdateType =
  | 'new_quote'
  | 'revised_quote'
  | 'contract'
  | 'invoice'
  | 'note'
  | 'photo'

// ─── Session (stored in Redis) ────────────────────────────────────────────────

export interface StoredSession {
  id: string
  flow: Flow
  category: CategoryId
  description: string
  zip: string
  preview: PreviewResult
  paid: boolean
  paidAt?: string
  product?: Product
  report?: DiagnosticBriefReport | QuoteShieldReport
  createdAt: string
  updatedAt: string
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface AnalyzeRequest {
  flow: Flow
  category: CategoryId
  description: string
  zip: string
  files: UploadedFile[]
}

export interface AnalyzeResponse {
  sessionId: string
  preview: PreviewResult
}

export interface GenerateReportRequest {
  stripeSessionId: string
}

export interface GenerateReportResponse {
  sessionId: string
  product: Product
}

export interface UpdateReportRequest {
  sessionId: string
  updateType: UpdateType
  files: UploadedFile[]
  note?: string
}

export interface UpdateReportResponse {
  report: QuoteShieldReport
}

export interface CheckoutRequest {
  sessionId: string
  product: Product
}

export interface CheckoutResponse {
  url: string
}

export interface ApiError {
  error: string
}
