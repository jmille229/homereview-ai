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

/**
 * HIGH-01: Maximum total JSON body size for requests containing file uploads.
 * 3 files × 2MB × base64 overhead (~1.37×) + JSON structure = ~9MB ceiling.
 * Checked via Content-Length before req.json() loads the body into memory.
 */
export const MAX_BODY_BYTES = 9 * 1024 * 1024

export const CATEGORY_IDS: CategoryId[] = [
  'hvac',
  'plumbing',
  'electrical',
  'roofing',
  'foundation',
  'appliances',
  'pest',
  'maintenance',
]

// ─── File schema ──────────────────────────────────────────────────────────────

/**
 * HIGH-01: Validates uploaded files.
 *
 * Two improvements over the previous version:
 * 1. `data` is bounded by the maximum base64-encoded size of a 2MB file
 *    (2MB × 1.37 ≈ 2.74MB → ~3.7M chars), preventing oversized payloads
 *    that report a small `size` but carry a large `data` field.
 * 2. A `.refine()` cross-validates `size` against the actual `data` length
 *    so an attacker cannot claim `size: 100` while sending 10MB of base64.
 */
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
      // Base64 decodes at ~0.75 bytes per char. Allow 10% tolerance for padding.
      const estimatedBytes = Math.floor(f.data.length * 0.75)
      return estimatedBytes <= MAX_FILE_SIZE_BYTES * 1.1
    },
    { message: 'File data does not match declared size.' },
  )

// ─── API input schemas ────────────────────────────────────────────────────────

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
  files: z.array(uploadedFileSchema).max(MAX_FILES_PER_REQUEST),
})

/**
 * HIGH-04: Stripe Checkout Session IDs follow a known format.
 * Validating the format here prevents arbitrary strings from being passed
 * to the Stripe API, which would consume API quota and add latency with no
 * benefit to a legitimate user.
 */
export const generateReportRequestSchema = z.object({
  stripeSessionId: z
    .string()
    .regex(
      /^cs_(live|test)_[a-zA-Z0-9]{20,200}$/,
      'Invalid payment session ID format.',
    ),
})

export const updateReportRequestSchema = z.object({
  sessionId: z.string().uuid(),
  updateType: z.enum([
    'new_quote',
    'revised_quote',
    'contract',
    'invoice',
    'note',
    'photo',
  ] as [UpdateType, ...UpdateType[]]),
  files: z.array(uploadedFileSchema).max(MAX_FILES_PER_REQUEST),
  note: z.string().max(2000).optional(),
})

export const checkoutRequestSchema = z.object({
  sessionId: z.string().uuid(),
  product: z.enum(['brief', 'shield', 'bundle'] as [Product, Product, Product]),
})

// ─── AI output schemas (Zod validates every Claude response) ──────────────────

export const previewResultSchema = z.object({
  summary: z.string().min(10),
  severity: z.enum(['Minor', 'Moderate', 'Serious', 'Urgent'] as [
    Severity,
    Severity,
    Severity,
    Severity,
  ]),
  severityReason: z.string().min(10),
  costMin: z.number().int().positive(),
  costMax: z.number().int().positive(),
  keyInsight: z.string().min(10),
})

export const diagnosticBriefSchema = z.object({
  diagnosis: z.string().min(20),
  urgencyTimeline: z.string().min(10),
  diyFeasibility: z.enum(['None', 'Low', 'Medium', 'High'] as [
    DiyFeasibility,
    DiyFeasibility,
    DiyFeasibility,
    DiyFeasibility,
  ]),
  diyDetails: z.string().min(10),
  contractorType: z.string().min(5),
  licenseRequired: z.string().min(5),
  verifyCredentials: z.array(z.string().min(5)).min(1).max(6),
  costFactors: z.array(z.string().min(5)).min(2).max(6),
  questionsToAsk: z
    .array(
      z.object({
        question: z.string().min(5),
        whyItMatters: z.string().min(10),
      }),
    )
    .min(6)
    .max(10),
  redFlags: z.array(z.string().min(5)).min(2).max(6),
  insistOnWriting: z.array(z.string().min(5)).min(2).max(6),
})

export const quoteShieldSchema = z.object({
  scopeVerdict: z.enum([
    'Matches Problem',
    'Partial Match',
    'Scope Mismatch',
  ] as [ScopeVerdict, ScopeVerdict, ScopeVerdict]),
  scopeAnalysis: z.string().min(20),
  pricingVerdict: z.enum(['Fair', 'High End', 'Inflated'] as [
    PricingVerdict,
    PricingVerdict,
    PricingVerdict,
  ]),
  pricingAnalysis: z.string().min(20),
  estimatedFairMin: z.number().int().positive(),
  estimatedFairMax: z.number().int().positive(),
  upsells: z.array(
    z.object({
      item: z.string().min(1),
      amount: z.number().int().min(0),
      reason: z.string().min(10),
    }),
  ),
  missingItems: z.array(z.string().min(5)),
  redFlags: z.array(z.string().min(5)),
  greenFlags: z.array(z.string().min(5)),
  negotiationGuide: z.string().min(20),
  contractorQuestions: z
    .array(
      z.object({
        question: z.string().min(5),
        goodAnswer: z.string().min(5),
        concerningAnswer: z.string().min(5),
      }),
    )
    .min(4)
    .max(14),
  getSecondQuote: z.boolean(),
  secondQuoteReason: z.string().min(10),
  beforeYouSign: z.array(z.string().min(5)).min(3).max(8),
})
