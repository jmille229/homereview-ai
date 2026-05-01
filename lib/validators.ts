import { z } from 'zod'
import type {
  AllowedMimeType,
  CategoryId,
  DiyFeasibility,
  Flow,
  PricingVerdict,
  Product,
  Severity,
  ScopeVerdict,
  UpdateType,
} from './types'

// ─── Constants ────────────────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES: AllowedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB per file
export const MAX_FILES_PER_REQUEST = 3
export const MAX_BODY_BYTES = 9 * 1024 * 1024
export const MAX_FOLLOWUP_QUESTIONS = 2  // free pre-purchase follow-up limit

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
    (f) => {
      const estimatedBytes = Math.floor(f.data.length * 0.75)
      return estimatedBytes <= MAX_FILE_SIZE_BYTES * 1.1
    },
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
  answers: z.array(userAnswerSchema).max(4),  // max 4 clarifying answers
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
  ).max(50),  // cap history to prevent enormous payloads
})

export const generateReportRequestSchema = z.object({
  stripeSessionId: z
    .string()
    .regex(
      /^cs_(live|test)_[a-zA-Z0-9]{20,200}$/,
      'Invalid payment session ID format.',
    ),
})

export const updateReportRequestSchema = z.object({
  sessionId:  z.string().uuid(),
  updateType: z.enum([
    'new_quote', 'revised_quote', 'contract', 'invoice', 'note', 'photo',
  ] as [UpdateType, ...UpdateType[]]),
  files: z.array(uploadedFileSchema).max(MAX_FILES_PER_REQUEST),
  note:  z.string().max(2000).optional(),
})

export const checkoutRequestSchema = z.object({
  sessionId: z.string().uuid(),
  product:   z.enum(['brief', 'shield', 'bundle'] as [Product, Product, Product]),
})

// ─── AI output schemas ────────────────────────────────────────────────────────

export const questionsResultSchema = z.object({
  questions: z.array(
    z.object({
      id:       z.string().min(1),
      question: z.string().min(10).max(300),
    })
  ).min(2).max(4),
})

export const previewResultSchema = z.object({
  summary:        z.string().min(10),
  severity:       z.enum(['Minor', 'Moderate', 'Serious', 'Urgent'] as [Severity, Severity, Severity, Severity]),
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
  verifyCredentials: z.array(z.string().min(5)).min(1).max(6),
  costFactors:       z.array(z.string().min(5)).min(2).max(6),
  questionsToAsk:    z.array(z.object({ question: z.string().min(5), whyItMatters: z.string().min(10) })).min(6).max(10),
  redFlags:          z.array(z.string().min(5)).min(2).max(6),
  insistOnWriting:   z.array(z.string().min(5)).min(2).max(6),
})

export const quoteShieldSchema = z.object({
  scopeVerdict:        z.enum(['Matches Problem', 'Partial Match', 'Scope Mismatch'] as [ScopeVerdict, ScopeVerdict, ScopeVerdict]),
  scopeAnalysis:       z.string().min(20),
  pricingVerdict:      z.enum(['Fair', 'High End', 'Inflated'] as [PricingVerdict, PricingVerdict, PricingVerdict]),
  pricingAnalysis:     z.string().min(20),
  estimatedFairMin:    z.number().int().positive(),
  estimatedFairMax:    z.number().int().positive(),
  upsells:             z.array(z.object({ item: z.string().min(1), amount: z.number().int().min(0), reason: z.string().min(10) })),
  missingItems:        z.array(z.string().min(5)),
  redFlags:            z.array(z.string().min(5)),
  greenFlags:          z.array(z.string().min(5)),
  negotiationGuide:    z.string().min(20),
  contractorQuestions: z.array(z.object({ question: z.string().min(5), goodAnswer: z.string().min(5), concerningAnswer: z.string().min(5) })).min(4).max(14),
  getSecondQuote:      z.boolean(),
  secondQuoteReason:   z.string().min(10),
  beforeYouSign:       z.array(z.string().min(5)).min(3).max(8),
})
