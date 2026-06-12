import { z } from 'zod'
import type {
  AllowedMimeType,
  CategoryId,
  DiagnosisVerdict,
  DiyFeasibility,
  Flow,
  PricingVerdict,
  Product,
  Severity,
  ScopeVerdict,
  UpdateType,
} from './enums'

// ─── Constants ────────────────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES: AllowedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export const MAX_FILE_SIZE_BYTES    = 2 * 1024 * 1024
export const MAX_FILES_PER_REQUEST  = 3
export const MAX_BODY_BYTES         = 9 * 1024 * 1024
/** Hard cap for request bodies that never legitimately carry files. */
export const MAX_JSON_BYTES         = 64 * 1024
export const MAX_FOLLOWUP_QUESTIONS = 2

export const CATEGORY_IDS: CategoryId[] = [
  'hvac', 'plumbing', 'electrical', 'roofing',
  'foundation', 'appliances', 'pest', 'maintenance',
]

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const MAX_BASE64_CHARS = Math.ceil(MAX_FILE_SIZE_BYTES * 1.4)

const uploadedFileSchema = z
  .object({
    name: z.string().min(1).max(255),
    type: z.enum(ALLOWED_MIME_TYPES as [AllowedMimeType, ...AllowedMimeType[]]),
    size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
    data: z.string().min(1).max(MAX_BASE64_CHARS),
  })
  .refine(
    (f) => Math.floor(f.data.length * 0.75) <= MAX_FILE_SIZE_BYTES * 1.1,
    { message: 'File data does not match declared size.' },
  )

const userAnswerSchema = z.object({
  questionId: z.string().min(1).max(50),
  question:   z.string().min(1).max(500),
  answer:     z.string().min(0).max(1000),
})

// ─── API input schemas ────────────────────────────────────────────────────────

export const questionsRequestSchema = z.object({
  flow:        z.enum(['pre', 'post'] as [Flow, Flow]),
  category:    z.enum(CATEGORY_IDS as [CategoryId, ...CategoryId[]]),
  description: z.string().min(20).max(4000),
  // For post-quote flow, the uploaded contractor quote document is included
  // so Claude can read the quote directly before generating clarifying questions.
  // This prevents asking the homeowner to describe what the quote already states.
  files:       z.array(uploadedFileSchema).max(MAX_FILES_PER_REQUEST).optional(),
})

export const analyzeRequestSchema = z.object({
  flow: z.enum(['pre', 'post'] as [Flow, Flow]),
  category: z.enum(CATEGORY_IDS as [CategoryId, ...CategoryId[]]),
  description: z
    .string()
    .min(20, 'Please provide at least 20 characters describing the issue.')
    .max(4000, 'Description must be under 4,000 characters.'),
  zip: z
    .string()
    .regex(/^\d{5}$/, 'Please enter a valid 5-digit US zip code.')
    .or(z.literal('')),
  files:   z.array(uploadedFileSchema).max(MAX_FILES_PER_REQUEST),
  answers: z.array(userAnswerSchema).max(4),
})

export const followupRequestSchema = z.object({
  sessionId: z.string().uuid(),
  question:  z.string().min(1).max(1000),
})

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message:   z.string().min(1).max(2000),
  history:   z.array(
    z.object({
      role:      z.enum(['user', 'assistant']),
      content:   z.string().min(1).max(4000),
      timestamp: z.string(),
    })
  ).max(50),
})

export const generateReportRequestSchema = z.object({
  stripeSessionId: z
    .string()
    .regex(
      /^cs_(live|test)_[a-zA-Z0-9]{20,200}$/,
      'Invalid payment session ID format.',
    ),
  // Files are optional — present for post-quote (Quote Shield) flow where
  // the uploaded contractor quote document is stored in sessionStorage on the
  // client and re-sent at report generation time. Not sent for pre-quote flow.
  // Optional on retry too, since sessionStorage may have been cleared.
  files: z.array(uploadedFileSchema).max(MAX_FILES_PER_REQUEST).optional(),
})

export const updateReportRequestSchema = z.object({
  sessionId:  z.string().uuid(),
  updateType: z.enum([
    'new_quote', 'revised_quote', 'contract', 'invoice', 'note', 'photo',
  ] as [UpdateType, ...UpdateType[]]),
  files: z.array(uploadedFileSchema).max(MAX_FILES_PER_REQUEST),
  note:  z.string().max(2000).optional(),
})

export const gateRequestSchema = z.object({
  token: z.string().min(1).max(4096),
})

export const reclaimRequestSchema = z.object({
  sessionId: z.string().uuid(),
  email:     z.string().email('Enter a valid email address.').max(320),
})

export const checkoutRequestSchema = z.object({
  sessionId: z.string().uuid(),
  product:   z.enum(['brief', 'shield', 'bundle'] as [Product, Product, Product]),
})

// ─── AI output schemas ────────────────────────────────────────────────────────
//
// Design principle: Zod validates STRUCTURE — required fields exist, types are
// correct, strings are non-empty. It does NOT enforce array count limits on AI
// output. Count limits are a display concern enforced by repair functions in
// the report route after validation passes. This means a structurally valid
// report always saves, regardless of whether Sonnet returned 6 or 8 items in
// a list.

export const questionsResultSchema = z.object({
  // min(0): post-quote flow with a clear uploaded document may produce 0 questions
  // legitimately — the document already answers what we'd ask. The prompt controls
  // the target count per flow; the schema enforces structural validity only.
  questions: z.array(
    z.object({
      id:       z.string().min(1),
      question: z.string().min(10).max(300),
    })
  ).min(0).max(4),
})

export const previewResultSchema = z.object({
  summary:        z.string().min(10),
  severity:       z.enum(['Emergency', 'Urgent', 'Monitor', 'Cosmetic'] as [Severity, Severity, Severity, Severity]),
  severityReason: z.string().min(10),
  costMin:        z.number().int().positive(),
  costMax:        z.number().int().positive(),
  keyInsight:     z.string().min(10),
})

export const followupResultSchema = z.object({
  answer: z.string().min(10).max(1500),
})

export const chatResultSchema = z.object({
  reply: z.string().min(1).max(2000),
})

export const diagnosticBriefSchema = z.object({
  diagnosis:         z.string().min(20),
  urgencyTimeline:   z.string().min(10),
  diyFeasibility:    z.enum(['None', 'Low', 'Medium', 'High'] as [DiyFeasibility, DiyFeasibility, DiyFeasibility, DiyFeasibility]),
  diyDetails:        z.string().min(10),
  contractorType:    z.string().min(5),
  licenseRequired:   z.string().min(5),
  verifyCredentials: z.array(z.string().min(5)).min(1),
  costFactors:       z.array(z.string().min(5)).min(1),
  questionsToAsk:    z.array(z.object({
    question:     z.string().min(5),
    whyItMatters: z.string().min(10),
  })).min(1),
  redFlags:          z.array(z.string().min(5)).min(1),
  insistOnWriting:   z.array(z.string().min(5)).min(1),
})

export const quoteShieldSchema = z.object({
  diagnosisVerdict:    z.enum(['Sound', 'Questionable', 'Unsupported'] as [DiagnosisVerdict, DiagnosisVerdict, DiagnosisVerdict]),
  diagnosisAnalysis:   z.string().min(20),
  scopeVerdict:        z.enum(['Matches Problem', 'Partial Match', 'Scope Mismatch'] as [ScopeVerdict, ScopeVerdict, ScopeVerdict]),
  scopeAnalysis:       z.string().min(20),
  pricingVerdict:      z.enum(['Fair', 'High End', 'Inflated'] as [PricingVerdict, PricingVerdict, PricingVerdict]),
  pricingAnalysis:     z.string().min(20),
  estimatedFairMin:    z.number().int().positive(),
  estimatedFairMax:    z.number().int().positive(),
  upsells:             z.array(z.object({
    item:   z.string().min(1),
    amount: z.number().int().min(0),
    reason: z.string().min(10),
  })),
  missingItems:        z.array(z.string().min(5)),
  redFlags:            z.array(z.string().min(5)),
  greenFlags:          z.array(z.string().min(5)),
  negotiationGuide:    z.string().min(20),
  contractorQuestions: z.array(z.object({
    question:         z.string().min(5),
    goodAnswer:       z.string().min(5),
    concerningAnswer: z.string().min(5),
  })).min(1),
  getSecondQuote:      z.boolean(),
  secondQuoteReason:   z.string().min(10),
  beforeYouSign:       z.array(z.string().min(5)).min(1),
})
