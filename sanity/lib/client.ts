import { createClient } from '@sanity/client'
import { apiVersion, dataset, projectId } from '../env'

/**
 * Read-only Sanity client. Used server-side (in RSC / ISR) to fetch published
 * Learn content. useCdn:true serves from Sanity's cached CDN — fast and fine for
 * published content, since freshness is handled by ISR + the revalidate webhook.
 */
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
})
