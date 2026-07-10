import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './sanity/schemaTypes'
import { projectId, dataset, apiVersion } from './sanity/env'

/**
 * Sanity Studio config. This is used by the Sanity CLI (`npx sanity dev` /
 * `npx sanity deploy`) to run the content-editing Studio — it is NOT imported
 * by the Next.js app, so none of the heavy Studio code ships in the app bundle.
 */
export default defineConfig({
  name: 'default',
  title: 'HomeReview',
  projectId,
  dataset,
  plugins: [structureTool(), visionTool({ defaultApiVersion: apiVersion })],
  schema: { types: schemaTypes },
})
