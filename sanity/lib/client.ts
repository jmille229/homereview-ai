import { createClient } from '@sanity/client'
import { apiVersion, dataset, projectId } from '../env'

/**
 * Read-only Sanity client. Used server-side (in RSC / ISR) to fetch published
 * Learn content.
 *
 * useCdn:false — freshness is driven by the publish → revalidate webhook, and
 * Sanity's API CDN can lag a publish by a few seconds. Because these fetches only
 * run during ISR/on-demand revalidation (not per visitor), going direct to the
 * API guarantees a revalidated render reflects the just-published content
 * immediately, with negligible cost.
 */
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
})
