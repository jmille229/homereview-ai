import type { CategoryId } from './types'

/**
 * Human-readable labels for each issue category.
 * Single source of truth — imported by all API routes that need it.
 *
 * These labels are interpolated into AI prompts so they should be
 * descriptive enough for the model to understand the domain context.
 */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  hvac:        'HVAC (Heating, Cooling & Air Quality)',
  plumbing:    'Plumbing',
  electrical:  'Electrical',
  roofing:     'Roofing & Exterior',
  foundation:  'Foundation & Structure',
  appliances:  'Appliances',
  pest:        'Pest & Mold',
  maintenance: 'General Maintenance',
}

/**
 * Returns the category label for a given CategoryId.
 * Throws at runtime if an unknown category is passed, which catches
 * validation gaps early rather than silently using a raw ID as a label.
 */
export function getCategoryLabel(category: CategoryId): string {
  const label = CATEGORY_LABELS[category]
  if (!label) throw new Error(`Unknown category: ${category}`)
  return label
}

/**
 * Maps the optional "also affects" related areas to their labels for prompt
 * context. Skips the primary category (it's already the report's lens) and any
 * unknown ids, so this is safe to call with raw stored values.
 */
export function getRelatedAreaIds(
  primary: CategoryId,
  relatedAreas: CategoryId[] | undefined,
): CategoryId[] {
  // De-dupe, drop the primary, drop unknowns — safe for raw stored/input values.
  return Array.from(new Set(relatedAreas ?? []))
    .filter((id) => id !== primary && !!CATEGORY_LABELS[id])
}

export function getRelatedAreaLabels(
  primary: CategoryId,
  relatedAreas: CategoryId[] | undefined,
): string[] {
  return getRelatedAreaIds(primary, relatedAreas).map((id) => CATEGORY_LABELS[id])
}
