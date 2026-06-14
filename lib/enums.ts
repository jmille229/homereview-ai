/**
 * lib/enums.ts — Primitive discriminated union types.
 *
 * This file is the ONLY place these types are defined. It has zero imports
 * and zero dependencies, making it safe to import from anywhere in the
 * codebase without risk of circular references.
 *
 * Design rule: this file contains ONLY string union types (discriminants).
 * No interfaces, no z.infer, no runtime code. Any type that needs to live
 * here is one that both validators.ts and types.ts must agree on.
 *
 * Import graph invariant:
 *   enums.ts      ← validators.ts
 *   enums.ts      ← types.ts
 *   validators.ts ← types.ts   (via z.infer — this is the single source of truth)
 *   types.ts      ← everything else
 */

// ─── Domain discriminants ──────────────────────────────────────────────────────

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

export type Product = 'brief' | 'shield'

export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf'

// ─── Severity / verdict enumerations ──────────────────────────────────────────

export type Severity         = 'Emergency' | 'Urgent' | 'Monitor' | 'Cosmetic'
export type DiyFeasibility   = 'None' | 'Low' | 'Medium' | 'High'
export type DiagnosisVerdict = 'Sound' | 'Questionable' | 'Unsupported'
export type ScopeVerdict     = 'Matches Problem' | 'Partial Match' | 'Scope Mismatch'
export type PricingVerdict   = 'Fair' | 'High End' | 'Inflated'

// ─── Lifecycle enumerations ────────────────────────────────────────────────────

export type ReportStatus = 'generating' | 'complete' | 'failed'

export type UpdateType =
  | 'new_quote'
  | 'revised_quote'
  | 'contract'
  | 'invoice'
  | 'note'
  | 'photo'
