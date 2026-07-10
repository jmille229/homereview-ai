import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import { projectId, dataset } from '../env'

// Build against project/dataset directly (no client dependency needed for URLs).
const builder = imageUrlBuilder({ projectId, dataset })

/** Returns a Sanity image URL builder for a given image reference. */
export function urlForImage(source: SanityImageSource) {
  return builder.image(source)
}
